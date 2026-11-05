// Safe fallback for expo-av in Expo Go SDK 52+ where ExponentAV is not bundled
export const Audio = {
  Sound: {
    createAsync: async (source, initialStatus, onPlaybackStatusUpdate) => {
      return {
        sound: {
          playAsync: async () => {},
          stopAsync: async () => {},
          unloadAsync: async () => {},
          setPositionAsync: async () => {},
          setOnPlaybackStatusUpdate: (cb) => {
            if (typeof cb === "function") {
              // Simulate finish for cleanup callback
              setTimeout(() => {
                try {
                  cb({ didJustFinish: true, isLoaded: true });
                } catch {}
              }, 100);
            }
          },
        },
        status: { isLoaded: true },
      };
    },
  },
  setAudioModeAsync: async () => {},
};

export default {
  Audio,
};
