export type PlayFrequency = 'rarely' | '1-2/month' | 'weekly' | '2-3/week' | 'daily';

export type UserProfile = {
  handicap: string;
  playsPerWeek: PlayFrequency;
  practicesPerWeek: PlayFrequency;
};

export type PosePoint = { x: number; y: number };

export type PoseLines = {
  nose: PosePoint | null;
  left_shoulder: PosePoint | null;
  right_shoulder: PosePoint | null;
  left_hip: PosePoint | null;
  right_hip: PosePoint | null;
  left_wrist: PosePoint | null;
  right_wrist: PosePoint | null;
  left_ankle: PosePoint | null;
  right_ankle: PosePoint | null;
  video_width: number;
  video_height: number;
  address_frame: number;
  fps: number;
  head_top_y: number | null;
  butt_edge_x: number | null;
};

export type CameraAngle = 'dtl' | 'face_on';
export type Handedness = 'right' | 'left';

export type TrackedPoint = {
  x_pct: number;
  y_pct: number;
  frame: number;
};

export type ShotTraceResult = {
  impact_frame: number;
  fps: number;
  duration: number;
  window_start_sec: number;
  video_width: number;
  video_height: number;
  tracked_points: TrackedPoint[];
};

export type SwingVideoInput = {
  uri: string;
  name: string;
  angle: CameraAngle;
  handedness: Handedness;
};

export type SwingPhase = {
  name: string;
  note: string;
};

export type SwingMetric = {
  label: string;
  value: string;
  detail: string;
  confidence: 'high' | 'medium' | 'low';
};

export type SwingReview = {
  id: string;
  summary: string;
  phases: SwingPhase[];
  metrics: SwingMetric[];
  createdAt: string;
};
