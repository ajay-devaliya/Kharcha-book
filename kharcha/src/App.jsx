import { ToastProvider } from './components/ui.jsx';
import AuthGate from './components/Auth.jsx';
import Shell from './components/Shell.jsx';
import { DataProvider } from './data/store.jsx';

export default function App() {
  return (
    <ToastProvider>
      <AuthGate>
        {(session) => (
          <DataProvider key={session ? session.user.id : 'local'} session={session}>
            <Shell />
          </DataProvider>
        )}
      </AuthGate>
    </ToastProvider>
  );
}
