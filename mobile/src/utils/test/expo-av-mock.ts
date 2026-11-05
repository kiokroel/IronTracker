export const Audio = {
  Sound: {
    createAsync: async () => ({
      sound: {
        playAsync: async () => {},
        stopAsync: async () => {},
        unloadAsync: async () => {},
        setPositionAsync: async () => {},
        setOnPlaybackStatusUpdate: (_cb?: any) => {},
      },
      status: { isLoaded: true },
    }),
  },
  setAudioModeAsync: async () => {},
};

export default {
  Audio,
};
