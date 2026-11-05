export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}

export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
  Rigid = "rigid",
  Soft = "soft",
}

export async function notificationAsync(_type?: NotificationFeedbackType): Promise<void> {
  // Mock no-op
}

export async function impactAsync(_style?: ImpactFeedbackStyle): Promise<void> {
  // Mock no-op
}

export async function selectionAsync(): Promise<void> {
  // Mock no-op
}

export default {
  NotificationFeedbackType,
  ImpactFeedbackStyle,
  notificationAsync,
  impactAsync,
  selectionAsync,
};
