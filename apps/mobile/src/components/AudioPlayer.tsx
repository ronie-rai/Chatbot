import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import { formatDuration } from "../utils/filePicker";

interface AudioPlayerProps {
  url?: string;
  duration?: number; // total duration in seconds
  isOwn?: boolean;
}

// Global reference to ensure only one audio plays at a time
let currentActiveAudio: HTMLAudioElement | null = null;
let currentStopCallback: (() => void) | null = null;

export function AudioPlayer({ url, duration = 0, isOwn = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (duration > 0) {
      setTotalDuration(duration);
    }
  }, [duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        if (currentActiveAudio === audioRef.current) {
          currentActiveAudio = null;
          currentStopCallback = null;
        }
      }
    };
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (!url) return;

    if (Platform.OS === "web" && typeof Audio !== "undefined") {
      if (!audioRef.current) {
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.ontimeupdate = () => {
          setCurrentTime(Math.floor(audio.currentTime));
        };

        audio.onloadedmetadata = () => {
          if (audio.duration && !isNaN(audio.duration)) {
            setTotalDuration(Math.round(audio.duration));
          }
        };

        audio.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (currentActiveAudio === audio) {
            currentActiveAudio = null;
            currentStopCallback = null;
          }
        };

        audio.onerror = () => {
          console.warn("[AudioPlayer] Error playing audio");
          setIsPlaying(false);
        };
      }

      const audio = audioRef.current;

      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        // Pause any currently playing audio
        if (currentActiveAudio && currentActiveAudio !== audio) {
          currentActiveAudio.pause();
          if (currentStopCallback) currentStopCallback();
        }

        currentActiveAudio = audio;
        currentStopCallback = handleStop;

        audio.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn("[AudioPlayer] Playback error:", err);
          setIsPlaying(false);
        });
      }
    }
  }, [url, isPlaying, handleStop]);

  // 24 waveform bar heights for rich visual look
  const waveformHeights = [
    8, 14, 20, 10, 16, 22, 28, 18, 12, 24, 30, 20, 14, 26, 22, 16, 12, 18, 24, 16, 10, 14, 8, 6,
  ];

  const progressFraction = totalDuration > 0 ? currentTime / totalDuration : 0;
  const activeBarCount = Math.floor(progressFraction * waveformHeights.length);

  const displayTime = isPlaying
    ? formatDuration(currentTime)
    : formatDuration(totalDuration || duration);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playBtn, isOwn ? styles.playBtnOwn : styles.playBtnReceived]}
        onPress={togglePlay}
        activeOpacity={0.8}
      >
        <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      </TouchableOpacity>

      <View style={styles.waveformWrapper}>
        <View style={styles.waveformContainer}>
          {waveformHeights.map((height, index) => {
            const isActive = index <= activeBarCount && isPlaying;
            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  { height },
                  isActive ? styles.waveformBarActive : styles.waveformBarInactive,
                ]}
              />
            );
          })}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.durationText}>{displayTime}</Text>
          <Text style={styles.micBadge}>🎙️</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    minWidth: 200,
    gap: Spacing.sm,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  playBtnOwn: {
    backgroundColor: Colors.primaryLight,
  },
  playBtnReceived: {
    backgroundColor: Colors.accent,
  },
  playIcon: {
    fontSize: 16,
    color: Colors.textLight,
    marginLeft: Platform.OS === "web" ? 2 : 1,
  },
  waveformWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    gap: 3,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  waveformBarActive: {
    backgroundColor: Colors.primaryLight,
  },
  waveformBarInactive: {
    backgroundColor: "#B0BEC5",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  durationText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  micBadge: {
    fontSize: 12,
  },
});
