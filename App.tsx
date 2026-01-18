
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Scene, StoryboardState } from './types';

const INITIAL_SCENES: Scene[] = [
  { id: 'C01', label: 'C01', description: '', imageUrl: null, loading: false, error: null },
  { id: 'C02', label: 'C02', description: '', imageUrl: null, loading: false, error: null },
  { id: 'C03', label: 'C03', description: '', imageUrl: null, loading: false, error: null },
  { id: 'C04', label: 'C04', description: '', imageUrl: null, loading: false, error: null },
  { id: 'C05', label: 'C05', description: '', imageUrl: null, loading: false, error: null },
  { id: 'C06', label: 'C06', description: '', imageUrl: null, loading: false, error: null },
];

export default function App() {
  const [productKeyword, setProductKeyword] = useState<string>('');
  const [productDescription, setProductDescription] = useState<string>('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [fullScript, setFullScript] = useState<string>('');
  const [scenes, setScenes] = useState<Scene[]>(INITIAL_SCENES);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [compositeImageUrl, setCompositeImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsing logic to split full script into C01-C06
  const parseScript = (scriptText: string) => {
    const newScenes = [...INITIAL_SCENES].map(s => ({ ...s }));
    const lines = scriptText.split('\n');
    let currentId = '';
    let currentContent = '';

    lines.forEach(line => {
      const match = line.match(/(镜头|scene)?\s*(c0[1-6])\s*[:：]?/i);
      if (match) {
        if (currentId) {
          const index = newScenes.findIndex(s => s.id.toLowerCase() === currentId.toLowerCase());
          if (index !== -1) newScenes[index].description = currentContent.trim();
        }
        currentId = match[2].toUpperCase();
        currentContent = line.replace(match[0], '').trim();
      } else if (currentId) {
        currentContent += ' ' + line.trim();
      }
    });

    if (currentId) {
      const index = newScenes.findIndex(s => s.id.toLowerCase() === currentId.toLowerCase());
      if (index !== -1) newScenes[index].description = currentContent.trim();
    }

    setScenes(newScenes);
  };

  // Synchronize individual scenes when fullScript changes
  useEffect(() => {
    if (fullScript) {
      parseScript(fullScript);
    }
  }, [fullScript]);

  const generateAiScript = async () => {
    if (!productKeyword.trim()) return;
    setIsGeneratingScript(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contextText = productDescription.trim() 
        ? `Product Description & Selling Points: ${productDescription}` 
        : '';
        
      const prompt = `Act as a professional advertising creative director. Generate a high-impact 15-second commercial video script for the product: "${productKeyword}".
      ${contextText}
      
      The output must consist of exactly 6 consecutive frames labeled C01 to C06.
      For each frame, provide a detailed visual action description suitable for a cinematic storyboard and any dialogue or voiceover.
      
      FORMAT REQUIREMENTS:
      C01: [Action description], [Dialogue/VO]
      C02: [Action description], [Dialogue/VO]
      ...
      C06: [Final branding shot and slogan]

      STRICT RULES:
      - Only output the script content.
      - No introductory text or concluding remarks.
      - Use professional cinematic language (e.g., Close-up, Wide shot, Tilt, Pan).
      - Ensure the story flows continuously through the 15 seconds.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const scriptText = response.text || '';
      setFullScript(scriptText);
    } catch (err: any) {
      setError("Failed to generate AI script: " + err.message);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const translateScript = async () => {
    if (!fullScript.trim()) return;
    setIsTranslating(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Translate the following storyboard script. If the content is in Chinese, translate it to English. If it is in English, translate it to Chinese. 
      Maintain the exact structure (C01:, C02:, etc.) and labeling. 
      Only return the translated text without any preamble.

      SCRIPT:
      ${fullScript}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const translatedText = response.text?.trim() || '';
      setFullScript(translatedText);
    } catch (err: any) {
      setError("Translation failed: " + err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const refineSingleScene = async (id: string) => {
    if (!productKeyword.trim()) {
      setError("Please enter a product keyword first to provide context for the refinement.");
      return;
    }
    setRefiningId(id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentDesc = scenes.find(s => s.id === id)?.description || "";
      const contextText = productDescription.trim() 
        ? `Product Context: ${productDescription}` 
        : '';

      const prompt = `Refine and regenerate the ad script description for frame ${id} of a 15-second commercial for "${productKeyword}".
      ${contextText}
      Current description: "${currentDesc}"
      
      Requirements:
      - Provide a cinematic visual action description.
      - Include dialogue or voiceover if applicable.
      - Style: High-impact, cinematic, black and white line art friendly.
      - Output ONLY the refined text for this single frame. No labels, no preamble.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const refinedText = response.text?.trim() || '';
      setScenes(prev => prev.map(s => s.id === id ? { ...s, description: refinedText } : s));
    } catch (err: any) {
      setError(`Failed to refine ${id}: ` + err.message);
    } finally {
      setRefiningId(null);
    }
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = () => {
    if (!compositeImageUrl) return;
    const link = document.createElement('a');
    link.href = compositeImageUrl;
    link.download = `storyboard-grid-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCompositeStoryboard = async () => {
    if (scenes.every(s => !s.description)) {
      setError("Please provide scene descriptions first.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const scenePrompts = scenes
        .map(s => `Frame ${s.id}: ${s.description || 'Empty scene'}`)
        .join('\n');

      const prompt = `
        Create a professional cinematic 3x2 grid storyboard layout on a single 16:9 canvas.
        There must be exactly 6 equal-sized frames arranged in 3 columns and 2 rows.
        
        Style: Clean, sharp black and white line art (sketch style). 
        Characters: Outline silhouettes only, no facial details.
        
        LAYOUT INSTRUCTIONS:
        - Arrange the following 6 scenes in a strict 3x2 grid.
        - Each frame must have its ID (C01, C02, etc.) clearly labeled in the top-left corner in English.
        
        SCENE DESCRIPTIONS:
        ${scenePrompts}
        
        STRICT RULES:
        - BLACK AND WHITE LINE ART ONLY.
        - NO COLORS.
        - ALL TEXT IN ENGLISH.
        - CINEMATIC COMPOSITION FOR EACH FRAME.
      `;

      const parts: any[] = [{ text: prompt }];
      
      if (referenceImage) {
        const base64Data = referenceImage.split(',')[1] || referenceImage;
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: base64Data,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          }
        }
      });

      let imageUrl = null;
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setCompositeImageUrl(imageUrl);
      } else {
        throw new Error("Generation failed - no image data returned.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate storyboard.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-4 sticky top-0 z-50 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded flex items-center justify-center rotate-3 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <i className="fa-solid fa-film text-black text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter">STORY<span className="text-zinc-500">GRID</span></h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Cinematic 3x2 AI Generator</p>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 transition px-4 py-2 rounded-lg text-xs font-bold border border-zinc-700 uppercase tracking-widest"
          >
            <i className="fa-solid fa-upload"></i>
            {referenceImage ? "Replace Ref" : "Product Ref"}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleReferenceUpload} 
          />
          
          <button 
            onClick={generateCompositeStoryboard}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            {isGenerating ? (
              <><i className="fa-solid fa-circle-notch animate-spin"></i> Processing...</>
            ) : (
              <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate Grid</>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-8 flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto w-full">
        
        {/* Left Panel: Inputs */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          {/* AI Script Assistant Section */}
          <section className="bg-zinc-900/80 p-6 rounded-2xl border border-zinc-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <i className="fa-solid fa-magic text-zinc-500"></i> Script Assistant
              </h2>
              <button 
                onClick={generateAiScript}
                disabled={isGeneratingScript || !productKeyword.trim()}
                className="bg-white text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {isGeneratingScript ? <i className="fa-solid fa-circle-notch animate-spin"></i> : "Write Script"}
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Product Keyword</label>
                <input 
                  type="text" 
                  placeholder="e.g. Smart Watch, Organic Coffee..."
                  value={productKeyword}
                  onChange={(e) => setProductKeyword(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-white transition"
                  onKeyDown={(e) => e.key === 'Enter' && generateAiScript()}
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Product Description (Optional)</label>
                <textarea 
                  placeholder="What does it do? Key selling points? Unique features..."
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-white transition min-h-[80px] resize-none custom-scrollbar"
                />
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square"></i> Full Script Editor
              </h2>
              <button 
                onClick={translateScript}
                disabled={isTranslating || !fullScript.trim()}
                className="text-[9px] font-black uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-3 py-1 rounded-md border border-zinc-700 transition flex items-center gap-1.5 disabled:opacity-50"
                title="Translate script between Chinese and English"
              >
                {isTranslating ? (
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                ) : (
                  <i className="fa-solid fa-language text-zinc-500"></i>
                )}
                中/En Toggle
              </button>
            </div>
            <textarea
              placeholder="Paste your C01-C06 script here or use the assistant above..."
              value={fullScript}
              onChange={(e) => setFullScript(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 min-h-[120px] transition resize-none custom-scrollbar"
            />
          </section>

          <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 flex flex-col gap-4 overflow-hidden">
             <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <i className="fa-solid fa-list-check"></i> Parsed Scenes
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
              {scenes.map((scene) => (
                <div key={scene.id} className="bg-black/40 p-3 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition group relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 group-hover:text-white transition">{scene.id}</span>
                    <button 
                      onClick={() => refineSingleScene(scene.id)}
                      disabled={refiningId === scene.id}
                      className="text-[9px] font-black uppercase bg-zinc-700/50 hover:bg-zinc-600 text-zinc-400 hover:text-white px-2 py-0.5 rounded transition flex items-center gap-1.5"
                      title={`Refine ${scene.id} with AI`}
                    >
                      {refiningId === scene.id ? (
                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                      ) : (
                        <i className="fa-solid fa-wand-sparkles"></i>
                      )}
                      Refine
                    </button>
                  </div>
                  <textarea
                    value={scene.description}
                    onChange={(e) => {
                      const newScenes = [...scenes];
                      const idx = newScenes.findIndex(s => s.id === scene.id);
                      newScenes[idx].description = e.target.value;
                      setScenes(newScenes);
                    }}
                    placeholder={`Scene ${scene.id} details...`}
                    className="w-full bg-transparent border-none p-0 text-xs text-zinc-400 focus:outline-none focus:ring-0 resize-none min-h-[40px] leading-relaxed"
                  />
                </div>
              ))}
            </div>
          </section>

          {referenceImage && (
            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center gap-4">
              <img src={referenceImage} className="w-16 h-16 object-cover rounded-lg border border-zinc-700" alt="Ref" />
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Product Reference Active</p>
                <button 
                  onClick={() => setReferenceImage(null)}
                  className="text-[10px] text-red-500 hover:text-red-400 font-bold"
                >
                  Remove Reference
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: The Output Canvas */}
        <div className="lg:w-2/3 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <i className="fa-solid fa-clapperboard"></i> 3x2 Master Storyboard
            </h2>
            {compositeImageUrl && (
               <div className="flex gap-2">
                  <button 
                    onClick={downloadImage}
                    className="text-[10px] font-bold bg-zinc-800 text-white px-4 py-1.5 rounded-full hover:bg-zinc-700 border border-zinc-700 transition uppercase flex items-center gap-2"
                  >
                    <i className="fa-solid fa-download"></i> Download Grid
                  </button>
               </div>
            )}
          </div>

          <div className="relative aspect-16-9 bg-black rounded-3xl border border-zinc-800 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center group">
            {isGenerating && (
              <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-10">
                <div className="relative w-24 h-24 mb-6">
                  <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-r-2 border-zinc-600 rounded-full animate-spin [animation-duration:1.5s]"></div>
                  <i className="fa-solid fa-paintbrush absolute inset-0 m-auto w-fit h-fit text-white"></i>
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest mb-2">Illustrating Masterpiece</h3>
                <p className="text-zinc-500 text-xs max-w-xs uppercase leading-relaxed font-bold tracking-tighter">
                  Compositing 6 frames into a high-fidelity cinematic 3x2 grid. Line art generation in progress...
                </p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 z-20 bg-red-950/20 flex flex-col items-center justify-center text-center p-10">
                <i className="fa-solid fa-triangle-exclamation text-red-500 text-4xl mb-4"></i>
                <p className="text-red-200 font-bold max-w-xs">{error}</p>
                <button 
                  onClick={generateCompositeStoryboard}
                  className="mt-6 bg-red-500 hover:bg-red-400 text-white px-6 py-2 rounded-full text-xs font-bold uppercase transition"
                >
                  Try Again
                </button>
              </div>
            )}

            {compositeImageUrl ? (
              <img 
                src={compositeImageUrl} 
                alt="Storyboard Grid" 
                className="w-full h-full object-contain"
              />
            ) : (
              !isGenerating && (
                <div className="text-center p-12 opacity-20 group-hover:opacity-40 transition-opacity duration-1000">
                  <i className="fa-solid fa-layer-group text-8xl mb-6"></i>
                  <p className="text-sm font-black uppercase tracking-[0.3em]">Canvas Ready for Generation</p>
                  <p className="text-[10px] mt-2 uppercase font-medium">Use Script Assistant or refine details to begin</p>
                </div>
              )
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">
               <h4 className="text-[10px] font-black uppercase text-zinc-500 mb-2 tracking-widest">Generation Specs</h4>
               <ul className="text-[10px] text-zinc-400 space-y-1 font-mono">
                 <li>• Model: Gemini 2.5 Flash Image</li>
                 <li>• Layout: 3x2 Cinematic Grid</li>
                 <li>• Style: B&W High-Contrast Line Art</li>
                 <li>• Resolution: 16:9 Aspect Ratio</li>
               </ul>
             </div>
             <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">
               <h4 className="text-[10px] font-black uppercase text-zinc-500 mb-2 tracking-widest">Composite Rule</h4>
               <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                 "One request, six stories. The system optimizes for a unified visual aesthetic across all frames by generating them simultaneously on a single master canvas."
               </p>
             </div>
          </div>
        </div>
      </main>

      <footer className="p-8 border-t border-zinc-900 bg-black/50 text-center">
        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.5em]">
          Powered by Gemini AI &bull; Created for Visual Storytellers &bull; © 2024
        </p>
      </footer>
    </div>
  );
}
