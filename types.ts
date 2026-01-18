
export interface Scene {
  id: string;
  label: string;
  description: string;
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
}

export interface StoryboardState {
  scenes: Scene[];
  referenceImage: string | null;
  isGeneratingAll: boolean;
}
