import { MenuGrid } from "./MenuGrid";
import { Card, CardContent } from "@/components/card";

interface HomeProps {
  onNavigate: (page: string) => void;
}

export const Home = ({ onNavigate }: HomeProps) => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
            VATS Desktop
          </h1>
          <p className="text-muted-foreground text-lg">
            Versatile Audio Transcription & Summarization
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Local-first AI-powered media processing
          </p>
        </div>

        {/* Menu Grid */}
        <Card>
          <CardContent className="pt-6">
            <MenuGrid onSelect={onNavigate} />
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>VATS v1.0.0 — Built with Tauri + React</p>
        </div>
      </div>
    </div>
  );
};
