
"use client";
import { useState } from "react";
import html2canvas from "html2canvas";
import { useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { reportBug } from "@/actions/report-bug-action";
import { Button } from "@/components/ui/button";

export default function BugReporter() {
  const [isOpen, setIsOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { user } = useUser(); 
  const { toast } = useToast();

  const handleCapture = async () => {
    try {
      const button = document.getElementById("bug-trigger-btn");
      if (button) button.style.display = "none";

      const canvas = await html2canvas(document.body, { 
        useCORS: true,
        logging: false 
      });
      const image = canvas.toDataURL("image/png");
      setScreenshot(image);
      setIsOpen(true);

      if (button) button.style.display = "flex";
    } catch (err) {
      console.error("Screenshot failed", err);
      const button = document.getElementById("bug-trigger-btn");
      if (button) button.style.display = "flex";
    }
  };

  const handleSubmit = async () => {
    if (!screenshot || !user) return;
    setLoading(true);

    try {
      await reportBug({
        screenshotDataUrl: screenshot,
        userEmail: user.email || 'Anonymous',
        notes: description,
        pageUrl: window.location.href,
        browser: navigator.userAgent,
        userId: user.uid,
      });
      
      toast({ title: "Report sent!", description: "Thanks for helping us improve." });
      setIsOpen(false);
      setDescription("");
      setScreenshot(null);
    } catch (error: any) {
      console.error("Error submitting report", error);
      toast({ variant: 'destructive', title: "Failed to send report", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        id="bug-trigger-btn"
        variant="destructive"
        size="icon"
        onClick={handleCapture}
        className="h-12 w-12 rounded-full"
      >
        <span className="text-2xl">🐞</span>
        <span className="sr-only">Report Bug</span>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Report an Issue / Suggest a feature</h2>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        
        {screenshot && (
          <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <p className="text-xs text-gray-500 p-2 border-b">Screen Capture Preview:</p>
            <img src={screenshot} alt="Screenshot" className="w-full h-40 object-cover object-top opacity-90" />
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">
          What happened?
        </label>
        <textarea
          className="w-full border border-gray-300 p-3 rounded-lg mb-4 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          rows={3}
          placeholder="I clicked the save button and nothing happened..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-3">
          <button 
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-all flex items-center gap-2"
          >
            {loading ? (
              <><span>Sending...</span></>
            ) : (
              "Submit Report"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
