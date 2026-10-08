from __future__ import annotations

import argparse
import asyncio
import logging
import time
from typing import NamedTuple

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("load_test")


class BenchmarkResult(NamedTuple):
    total_requests: int
    successful_requests: int
    failed_requests: int
    duration_seconds: float
    actual_rps: float
    latencies_ms: list[float]


async def send_request(
    client: httpx.AsyncClient,
    url: str,
    semaphore: asyncio.Semaphore,
) -> tuple[bool, float]:
    """Send a single GET request and measure latency in milliseconds."""
    async with semaphore:
        start_time = time.perf_counter()
        try:
            response = await client.get(url)
            elapsed = (time.perf_counter() - start_time) * 1000.0
            is_success = response.status_code == 200
            return is_success, elapsed
        except Exception:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return False, elapsed


async def run_load_test(
    base_url: str = "http://127.0.0.1:8002",
    endpoint: str = "/api/v1/leaderboard/tonnage",
    target_rps: int = 1000,
    duration_seconds: int = 10,
    concurrency_limit: int = 200,
) -> BenchmarkResult:
    """Run an asynchronous load test against the specified endpoint aiming for target_rps."""
    full_url = f"{base_url.rstrip('/')}{endpoint}"
    logger.info(
        "Starting load test on %s (Target RPS: %d, Duration: %ds, Concurrency limit: %d)",
        full_url,
        target_rps,
        duration_seconds,
        concurrency_limit,
    )

    semaphore = asyncio.Semaphore(concurrency_limit)
    limits = httpx.Limits(
        max_keepalive_connections=concurrency_limit,
        max_connections=concurrency_limit * 2,
    )
    timeout = httpx.Timeout(10.0, connect=5.0)

    total_target_requests = target_rps * duration_seconds
    delay_between_requests = 1.0 / target_rps if target_rps > 0 else 0.0

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        start_benchmark = time.perf_counter()
        tasks: list[asyncio.Task[tuple[bool, float]]] = []

        for _ in range(total_target_requests):
            req_start = time.perf_counter()
            tasks.append(asyncio.create_task(send_request(client, full_url, semaphore)))
            elapsed = time.perf_counter() - req_start
            sleep_time = delay_between_requests - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_duration = time.perf_counter() - start_benchmark

    latencies_ms: list[float] = []
    success_count = 0
    failure_count = 0

    for res in results:
        if isinstance(res, tuple):
            ok, latency = res
            latencies_ms.append(latency)
            if ok:
                success_count += 1
            else:
                failure_count += 1
        else:
            failure_count += 1

    actual_rps = (len(results) / total_duration) if total_duration > 0 else 0.0

    return BenchmarkResult(
        total_requests=len(results),
        successful_requests=success_count,
        failed_requests=failure_count,
        duration_seconds=total_duration,
        actual_rps=actual_rps,
        latencies_ms=latencies_ms,
    )


def print_report(result: BenchmarkResult) -> None:
    """Format and print benchmark summary report."""
    latencies = sorted(result.latencies_ms)
    count = len(latencies)

    p50 = latencies[int(count * 0.50)] if count > 0 else 0.0
    p95 = latencies[int(count * 0.95)] if count > 0 else 0.0
    p99 = latencies[int(count * 0.99)] if count > 0 else 0.0
    min_lat = latencies[0] if count > 0 else 0.0
    max_lat = latencies[-1] if count > 0 else 0.0
    avg_lat = (sum(latencies) / count) if count > 0 else 0.0

    print("\n" + "=" * 60)
    print("           LEADERBOARD SERVICE LOAD TEST REPORT            ")
    print("=" * 60)
    print(f"Total Requests:       {result.total_requests}")
    print(f"Successful (200 OK):  {result.successful_requests}")
    print(f"Failed:               {result.failed_requests}")
    print(f"Duration:             {result.duration_seconds:.2f} s")
    print(f"Throughput:           {result.actual_rps:.2f} RPS")
    print("-" * 60)
    print(f"Latency Min:          {min_lat:.2f} ms")
    print(f"Latency Avg:          {avg_lat:.2f} ms")
    print(f"Latency p50:          {p50:.2f} ms")
    print(f"Latency p95:          {p95:.2f} ms")
    print(f"Latency p99:          {p99:.2f} ms")
    print(f"Latency Max:          {max_lat:.2f} ms")
    print("=" * 60 + "\n")


def parse_args() -> argparse.Namespace:
    """Parse command line options."""
    parser = argparse.ArgumentParser(
        description="Load testing script for IronTracker Leaderboard Service (1000 RPS target)"
    )
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8002",
        help="Base URL of Leaderboard Service (default: http://127.0.0.1:8002)",
    )
    parser.add_argument(
        "--endpoint",
        default="/api/v1/leaderboard/tonnage",
        help="Endpoint path to test (default: /api/v1/leaderboard/tonnage)",
    )
    parser.add_argument(
        "--rps",
        type=int,
        default=1000,
        help="Target Requests Per Second (default: 1000)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=10,
        help="Duration of test in seconds (default: 10)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=200,
        help="Max concurrent connections (default: 200)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    bench_result = asyncio.run(
        run_load_test(
            base_url=args.url,
            endpoint=args.endpoint,
            target_rps=args.rps,
            duration_seconds=args.duration,
            concurrency_limit=args.concurrency,
        )
    )
    print_report(bench_result)
