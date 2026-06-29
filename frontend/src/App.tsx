import { VoiceCall } from './components/VoiceCall';
import './App.css';

function App() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md selection:bg-primary/30">
      <VoiceCall backendUrl={backendUrl} />
      
      {/* Decorative Gradients */}
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div className="fixed top-0 left-0 w-[300px] h-[300px] bg-secondary-container/5 blur-[100px] rounded-full -z-10 pointer-events-none"></div>
    </div>
  );
}

export default App;
