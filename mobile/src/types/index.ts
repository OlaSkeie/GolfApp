// Sentrale datatyper for appen.

export type SwingVideo = {
  id: string;
  uri: string; // lokal fil-URI til videoen
  createdAt: string; // ISO-dato
};

export type SwingReview = {
  id: string;
  videoId: string;
  summary: string; // kort oppsummering fra AI
  feedback: string; // full tilbakemelding
  createdAt: string; // ISO-dato
};
