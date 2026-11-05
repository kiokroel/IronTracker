export const Platform = {
  OS: "android" as const,
  select: <T>(objs: Partial<Record<string, T>> & { default?: T }): T | undefined => {
    return objs.android ?? objs.default;
  },
};

export const NativeModules = {
  SourceCode: {
    scriptURL: undefined,
  },
};

export default {
  Platform,
  NativeModules,
};
