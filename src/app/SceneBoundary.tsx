import { Component, type ReactNode } from "react";

import { reportSceneError } from "@/engine";

type SceneBoundaryProps = { children: ReactNode };
type SceneBoundaryState = { failed: boolean };

/**
 * The error boundary around the scene (#131): a throw from the lazy engine
 * chunk (its request failing) or from the scene's render lands here instead
 * of unmounting the page. The throw is reported the way the engine reports
 * its own failures (engine/sceneError.ts): logged once and recorded on the
 * store, which puts the poster in the scene's place (HomePage) — so this
 * renders nothing of its own once it has caught. A class, as React 19 still
 * has no hook for catching.
 */
export default class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true };
  }

  componentDidCatch(err: unknown): void {
    reportSceneError(err);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
