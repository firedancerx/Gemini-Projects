// Fix: Declare global variables for preact and htm to resolve reference errors.
declare var preact: any;
declare var htm: any;
declare var preactHooks: any;

import { GoogleGenAI, Type, Modality } from "@google/genai";

// Set up Preact and HTM
const { h, render } = preact;
const { useState, useEffect, useCallback, useRef } = preactHooks;
const html = htm.bind(h);

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Loading messages for the user during video generation
const loadingMessages = [
  "Warming up the AI engine...",
  "Brewing some creativity...",
  "Directing the digital actors...",
  "Rendering pixels into motion...",
  "This can take a few minutes...",
  "Polishing the final cut...",
  "Almost there, hold tight!",
];

// A custom hook for the typewriter effect
const useTypewriter = (text, speed = 30) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    setDisplayText(''); // Reset on new text
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < text.length) {
        setDisplayText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, speed);

    return () => {
      clearInterval(typingInterval);
    };
  }, [text, speed]);

  return displayText;
};

// The Virtual Avatar Component
const Avatar = ({ message, mood = 'idle' }) => {
    const typedMessage = useTypewriter(message);
    return html`
        <div class="flex flex-col items-center text-center p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50">
            <div class="w-32 h-32 avatar-base-float mood-${mood}">
                <svg class="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <g class="avatar-body">
                        <path d="M 25 90 C 25 70, 75 70, 75 90" fill="#4f46e5" />
                        <path d="M 20 60 C 20 30, 80 30, 80 60 Z" fill="#c7d2fe"/>
                        <circle cx="50" cy="50" r="28" fill="#1e1b4b"/>
                        <circle class="avatar-main-eye" cx="50" cy="50" r="25" fill="#312e81"/>
                        <circle cx="50" cy="50" r="15" fill="#4338ca"/>
                        <circle cx="50" cy="50" r="12" fill="#4f46e5"/>
                        <circle class="avatar-pupil-glow" cx="50" cy="50" r="6" fill="#c7d2fe"/>
                        <g class="avatar-eyes-container">
                            <!-- Default eyes -->
                            <circle class="avatar-eye" cx="35" cy="45" r="5" fill="white" />
                            <circle class="avatar-eye" cx="65" cy="45" r="5" fill="white" />
                            <!-- Happy eyes, hidden by default -->
                            <path class="avatar-eye-happy" d="M 30 45 Q 35 40 40 45" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
                            <path class="avatar-eye-happy" d="M 60 45 Q 65 40 70 45" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
                        </g>
                    </g>
                    <g class="avatar-antenna">
                        <rect x="48" y="15" width="4" height="15" fill="#c7d2fe" rx="2"/>
                        <circle cx="50" cy="12" r="3" fill="#a78bfa"/>
                    </g>
                </svg>
            </div>
            <div class="bg-gray-800 border border-gray-700 rounded-xl p-4 mt-4 w-full min-h-[100px]">
                <p class="text-indigo-300 text-left font-medium text-sm leading-relaxed">${typedMessage}<span class="typewriter-cursor"></span></p>
            </div>
        </div>
    `;
}

// Main App Component
const App = () => {
  const [storyIdea, setStoryIdea] = useState("");
  const [refinedIdeas, setRefinedIdeas] = useState([]);
  const [isRefining, setIsRefining] = useState(false);
  const [storyboard, setStoryboard] = useState([]);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [error, setError] = useState(null);
  const [avatarMessage, setAvatarMessage] = useState("Welcome! Let's create a story. What's your idea?");
  const [avatarMood, setAvatarMood] = useState("idle");
  
  // Editing Modal State
  const [editingScene, setEditingScene] = useState(null); // { id, prompt, videoUrl, frameDataUrl }
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedImageResult, setEditedImageResult] = useState(null);

  const activeTimers = useRef({});
  const videoRefs = useRef({});

  useEffect(() => {
    // Cleanup timers on component unmount
    return () => {
      Object.values(activeTimers.current).forEach(clearInterval);
    };
  }, []);

  const handleRefineIdea = async () => {
    if (!storyIdea.trim()) {
      setError("Please enter a story idea to refine.");
      return;
    }
    setError(null);
    setIsRefining(true);
    setRefinedIdeas([]);
    setAvatarMessage("Let's brainstorm! Thinking of some creative twists for you...");
    setAvatarMood("thinking");
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are a creative partner. Take the user's story idea and brainstorm 3 distinct, more detailed and imaginative alternatives. Present them clearly. Story Idea: "${storyIdea}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        alternatives: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        const parsed = JSON.parse(response.text);
        setRefinedIdeas([storyIdea, ...parsed.alternatives]);
        setAvatarMessage("Here are a few different angles on your story. Which one sparks your imagination?");
        setAvatarMood("success");
    } catch (err) {
        console.error("Error refining idea:", err);
        setError("Failed to refine the story idea. Please try again.");
        setAvatarMessage("Oh no, my circuits got crossed. Could you try refining that idea again?");
        setAvatarMood("error");
    } finally {
        setIsRefining(false);
    }
  };
  
  const handleGenerateStoryboard = async (idea) => {
    setError(null);
    setIsGeneratingStoryboard(true);
    setStoryboard([]);
    setStoryIdea(idea);
    setAvatarMessage("Great choice! Let's break this down into scenes. This is where the magic begins!");
    setAvatarMood("thinking");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are a storyboard assistant. Based on the following story idea, break it down into 5 distinct scenes for a short video. For each scene, provide two things: 1. A 'prompt': a visually descriptive sentence for an AI video generator. 2. A 'description': a brief one-sentence summary of the action or mood for display. Story Idea: "${idea}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    scene_number: { type: Type.INTEGER },
                    prompt: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                  required: ['scene_number', 'prompt', 'description'],
                },
              },
            },
          },
        },
      });
      
      const parsedResponse = JSON.parse(response.text);
      const newStoryboard = parsedResponse.scenes.map((scene, index) => ({
        id: `scene-${index}-${Date.now()}`,
        prompt: scene.prompt,
        description: scene.description,
        videoUrl: null,
        isLoading: false,
        loadingMessage: loadingMessages[0],
      }));
      setStoryboard(newStoryboard);
      setAvatarMessage("Your storyboard is ready! You can tweak the prompts or generate the videos directly.");
      setAvatarMood("success");
    } catch (err) {
      console.error("Error generating storyboard:", err);
      setError("Failed to generate storyboard. Please try again.");
      setAvatarMessage("Hmm, I couldn't seem to create the storyboard. Let's try again with that idea.");
      setAvatarMood("error");
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleGenerateVideo = useCallback(async (sceneId, image = null) => {
    const sceneIndex = storyboard.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    setAvatarMessage("Action! I'm rendering the video for this scene now. This part can take a few minutes, so hang tight!");
    setAvatarMood("thinking");
    const scenePrompt = storyboard[sceneIndex].prompt;

    setStoryboard(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: true, loadingMessage: loadingMessages[0], error: null } : s));

    if (activeTimers.current[sceneId]) clearInterval(activeTimers.current[sceneId]);
    activeTimers.current[sceneId] = setInterval(() => {
        setStoryboard(prev => {
            const currentScene = prev.find(s => s.id === sceneId);
            if (!currentScene || !currentScene.isLoading) {
                clearInterval(activeTimers.current[sceneId]);
                delete activeTimers.current[sceneId];
                return prev;
            }
            const currentIndex = loadingMessages.indexOf(currentScene.loadingMessage);
            const nextIndex = (currentIndex + 1) % loadingMessages.length;
            return prev.map(s => s.id === sceneId ? { ...s, loadingMessage: loadingMessages[nextIndex] } : s);
        });
    }, 3000);

    try {
      // Fix: Explicitly define the type for payload to allow for the optional 'image' property.
      const payload: {
        model: string;
        prompt: string;
        config: { numberOfVideos: number };
        image?: { imageBytes: string; mimeType: string };
      } = {
        model: 'veo-2.0-generate-001',
        prompt: scenePrompt,
        config: { numberOfVideos: 1 }
      };
      if (image) {
        payload.image = {
          imageBytes: image.split(',')[1],
          mimeType: 'image/jpeg'
        };
      }
      let operation = await ai.models.generateVideos(payload);

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await videoResponse.blob();
        const videoUrl = URL.createObjectURL(blob);
        setStoryboard(prev => prev.map(s => s.id === sceneId ? { ...s, videoUrl: videoUrl, isLoading: false } : s));
        setAvatarMessage("And... cut! That's a wrap for this scene. It's ready to view.");
        setAvatarMood("success");
      } else {
        throw new Error("No video URI found in response.");
      }
    } catch (err) {
      console.error(`Error generating video for scene ${sceneId}:`, err);
      setStoryboard(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: false, error: "Video generation failed." } : s));
      setAvatarMessage("Looks like there was a glitch in the render farm. The video for that scene failed.");
      setAvatarMood("error");
    } finally {
        clearInterval(activeTimers.current[sceneId]);
        delete activeTimers.current[sceneId];
    }
  }, [storyboard]);
  
  const handleGenerateAll = async () => {
      setAvatarMessage("Beginning the full sequence generation! This is the big one, so it'll take a while. Perfect time for a coffee!");
      setAvatarMood("thinking");
      for (const scene of storyboard) {
          if (!scene.videoUrl) {
              await handleGenerateVideo(scene.id);
          }
      }
  };
  
  const handleOpenEditModal = (sceneId) => {
    const videoEl = videoRefs.current[sceneId];
    if (!videoEl) return;
    
    setAvatarMessage("Entering the editing suite! What changes do you want to see in this frame?");
    setAvatarMood("idle");
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const frameDataUrl = canvas.toDataURL('image/jpeg');

    const scene = storyboard.find(s => s.id === sceneId);
    setEditingScene({ ...scene, frameDataUrl });
    setEditPrompt("");
    setEditedImageResult(null);
  };

  const handleCloseEditModal = () => {
    setEditingScene(null);
    setAvatarMessage("Back to the storyboard. What's next?");
    setAvatarMood("idle");
  };

  const handleGenerateEdit = async () => {
    if (!editPrompt.trim() || !editingScene) return;
    setIsEditing(true);
    setEditedImageResult(null);
    setAvatarMessage("Applying your edits now. Let's see how it turns out!");
    setAvatarMood("thinking");
    try {
        const base64Data = editingScene.frameDataUrl.split(',')[1];
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
                    { text: editPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes = part.inlineData.data;
                const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                setEditedImageResult(imageUrl);
                setAvatarMessage("Tada! Here's the edited frame. Like it?");
                setAvatarMood("success");
                break;
            }
        }
    } catch (err) {
        console.error("Error editing image:", err);
        setAvatarMessage("I couldn't quite get that edit right. Maybe try a different prompt?");
        setAvatarMood("error");
    } finally {
        setIsEditing(false);
    }
  };
  
  const handleGenerateVideoFromEdit = () => {
      if (!editedImageResult || !editingScene) return;
      setAvatarMessage("Taking the edited frame and creating a new video. Here we go!");
      setAvatarMood("thinking");
      handleGenerateVideo(editingScene.id, editedImageResult);
      handleCloseEditModal();
  };


  const updateScenePrompt = (sceneId, newPrompt) => {
      setStoryboard(prev => prev.map(s => s.id === sceneId ? { ...s, prompt: newPrompt } : s));
  };
  
  const resetApp = () => {
    setStoryIdea("");
    setRefinedIdeas([]);
    setStoryboard([]);
    setError(null);
    setIsGeneratingStoryboard(false);
    setIsRefining(false);
    setAvatarMessage("Back to the drawing board! What's our next big idea?");
    setAvatarMood("idle");
  };
  
  const isGeneratingAnyVideo = storyboard.some(s => s.isLoading);

  return html`
    <div class="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header class="w-full max-w-7xl text-center mb-8">
        <h1 class="text-4xl sm:text-5xl font-bold text-indigo-400 mb-2">AI Video Storyboard Agent</h1>
        <p class="text-lg text-gray-400">From a simple idea to a full video sequence.</p>
      </header>
      
      <div class="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 lg:gap-8">
        <aside class="lg:col-span-4 xl:col-span-3 mb-8 lg:mb-0">
            <div class="sticky top-8">
                <${Avatar} message=${avatarMessage} mood=${avatarMood} key=${avatarMessage} />
            </div>
        </aside>
        <main class="lg:col-span-8 xl:col-span-9">
            ${error && html`<div class="bg-red-800 border border-red-600 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <strong class="font-bold">Error: </strong>
              <span class="block sm:inline">${error}</span>
            </div>`}

            ${storyboard.length === 0 ? html`
              <div class="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
                ${refinedIdeas.length === 0 ? html`
                    <h2 class="text-2xl font-semibold mb-4 text-center">Step 1: What's Your Story?</h2>
                    <p class="text-gray-400 mb-6 text-center">Describe your video idea, and our AI creative partner will help you refine it.</p>
                    <textarea
                      class="w-full bg-gray-900 border border-gray-600 rounded-lg p-4 mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      rows="4"
                      placeholder="e.g., A robot explorer discovering a glowing forest on a distant planet."
                      value=${storyIdea}
                      onInput=${e => setStoryIdea(e.target.value)}
                      disabled=${isRefining}
                    ></textarea>
                    <button
                      onClick=${handleRefineIdea}
                      disabled=${isRefining || !storyIdea.trim()}
                      class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300"
                    >
                      ${isRefining ? html`<svg class="spinner w-5 h-5 mr-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Refini..."` : html`<i class="fa-solid fa-lightbulb mr-2"></i> Refine Story Idea`}
                    </button>
                ` : html `
                    <h2 class="text-2xl font-semibold mb-4 text-center">Step 2: Choose a Direction</h2>
                    <p class="text-gray-400 mb-6 text-center">Select one of the refined ideas, or stick with your original.</p>
                    <div class="space-y-4">
                        ${refinedIdeas.map((idea, index) => html`
                            <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                                <p class="text-gray-300 mb-3">${idea}</p>
                                <button
                                    onClick=${() => handleGenerateStoryboard(idea)}
                                    disabled=${isGeneratingStoryboard}
                                    class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-2 px-3 rounded-md transition-colors text-sm"
                                >
                                   ${isGeneratingStoryboard ? 'Working...' : html`<i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Create Storyboard ${index === 0 ? '(Original)' : ''}`}
                                </button>
                            </div>
                        `)}
                    </div>
                     <button onClick=${() => { setRefinedIdeas([]); setAvatarMessage("Let's try that again. What's your core idea?"); setAvatarMood('idle'); }} class="w-full text-gray-400 hover:text-white mt-6">Back</button>
                `}
              </div>
            ` : html`
              <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 class="text-2xl font-semibold">Your Storyboard</h2>
                <div class="flex gap-2">
                   <button onClick=${handleGenerateAll} disabled=${isGeneratingAnyVideo} class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"><i class="fa-solid fa-forward mr-2"></i> Generate All</button>
                   <button onClick=${resetApp} disabled=${isGeneratingAnyVideo} class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"><i class="fa-solid fa-arrow-left mr-2"></i> Start Over</button>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                ${storyboard.map((scene) => html`
                  <div key=${scene.id} class="scene-card bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
                    <div class="aspect-video bg-gray-900 flex items-center justify-center relative">
                      ${scene.isLoading ? html`
                        <div class="text-center p-4">
                          <svg class="spinner w-8 h-8 text-indigo-400 mx-auto mb-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <p class="text-sm text-gray-400">${scene.loadingMessage}</p>
                        </div>
                      ` : scene.videoUrl ? html`
                        <video ref=${el => videoRefs.current[scene.id] = el} src=${scene.videoUrl} controls class="w-full h-full object-cover" crossOrigin="anonymous"></video>
                      ` : scene.error ? html `
                         <div class="text-center p-4 text-red-400">
                            <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                            <p>${scene.error}</p>
                         </div>
                      `: html`
                        <div class="text-center p-4 text-gray-500">
                          <i class="fa-solid fa-video text-4xl"></i>
                          <p class="mt-2">Ready to generate</p>
                        </div>
                      `}
                    </div>
                    <div class="p-4 flex flex-col flex-grow">
                        <p class="text-sm text-gray-400 mb-2">${scene.description}</p>
                        <textarea
                          class="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm flex-grow mb-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          rows="3"
                          value=${scene.prompt}
                          onInput=${e => updateScenePrompt(scene.id, e.target.value)}
                        ></textarea>
                        <div class="mt-auto grid grid-cols-2 gap-2">
                            <button onClick=${() => handleGenerateVideo(scene.id)} disabled=${scene.isLoading} class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-2 rounded-md text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center">
                               <i class="fa-solid fa-play mr-2"></i> Generate
                            </button>
                            <button onClick=${() => handleOpenEditModal(scene.id)} disabled=${!scene.videoUrl} class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-2 rounded-md text-sm transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center">
                                <i class="fa-solid fa-pen-to-square mr-2"></i> Edit Frame
                            </button>
                        </div>
                    </div>
                  </div>
                `)}
              </div>
            `}
        </main>
      </div>

      ${editingScene && html`
        <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 modal-fade-in">
            <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700">
                <header class="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 class="text-xl font-semibold">Edit Frame</h3>
                    <button onClick=${handleCloseEditModal} class="text-gray-400 hover:text-white">&times;</button>
                </header>
                <div class="p-6 overflow-y-auto">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <h4 class="text-lg font-medium mb-2 text-center">Current Frame</h4>
                            <img src=${editingScene.frameDataUrl} alt="Current frame" class="rounded-lg w-full" />
                        </div>
                         <div>
                            <h4 class="text-lg font-medium mb-2 text-center">Edited Result</h4>
                            <div class="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                                ${isEditing ? html`
                                    <svg class="spinner w-8 h-8 text-indigo-400" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ` : editedImageResult ? html`
                                    <img src=${editedImageResult} alt="Edited frame" class="rounded-lg w-full" />
                                ` : html`
                                    <p class="text-gray-500">Edit will appear here</p>
                                `}
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-4">
                        <input
                            type="text"
                            class="flex-grow bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            placeholder="e.g., add a small, friendly robot next to the tree"
                            value=${editPrompt}
                            onInput=${e => setEditPrompt(e.target.value)}
                            disabled=${isEditing}
                        />
                         <button onClick=${handleGenerateEdit} disabled=${isEditing || !editPrompt.trim()} class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center transition-all">
                           ${isEditing ? 'Applying...' : 'Apply Edit'}
                         </button>
                    </div>
                </div>
                <footer class="p-4 border-t border-gray-700 flex justify-end gap-3">
                    <button onClick=${handleCloseEditModal} class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button onClick=${handleGenerateVideoFromEdit} disabled=${!editedImageResult} class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
                        Create Video from Edit
                    </button>
                </footer>
            </div>
        </div>
      `}
    </div>
  `;
};

render(html`<${App} />`, document.getElementById('root'));