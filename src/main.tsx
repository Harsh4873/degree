import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { PLANNER_STORAGE_KEY } from './App';
import './styles.css';

type RecoveryProps = { children: ReactNode };
type RecoveryState = { failed: boolean };

class PlannerRecoveryBoundary extends Component<RecoveryProps, RecoveryState> {
  state: RecoveryState = { failed: false };

  static getDerivedStateFromError(): RecoveryState {
    return { failed: true };
  }

  reset = () => {
    try {
      window.localStorage.removeItem(PLANNER_STORAGE_KEY);
    } catch {
      // Reload still remounts the seed board when storage is blocked.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="planner-recovery">
        <h1>This plan could not be shown</h1>
        <p>The saved board has a shape this page cannot read. Reset it to an empty four-term starter.</p>
        <button className="primary-button" type="button" onClick={this.reset}>Reset plan</button>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlannerRecoveryBoundary>
      <App />
    </PlannerRecoveryBoundary>
  </StrictMode>,
);
