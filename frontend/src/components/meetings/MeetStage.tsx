import { LiveKitRoom, RoomAudioRenderer, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import "./MeetStage.css";

type Props = {
  serverUrl: string;
  token: string;
  onLeave?: () => void;
};

/**
 * Browser WebRTC client for LiveKit.
 * serverUrl = wss://….livekit.cloud (signaling / SFU)
 * token     = JWT minted by our FastAPI backend
 */
export function MeetStage({ serverUrl, token, onLeave }: Props) {
  return (
    <div className="meet-stage-live" data-lk-theme="default">
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect
        video
        audio
        onDisconnected={onLeave}
        onError={(err) => console.error("LiveKit room error", err)}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
