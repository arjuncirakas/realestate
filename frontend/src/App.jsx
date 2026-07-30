import { AppRoutes } from '@/routes/index.jsx';

/**
 * The application. Providers are mounted in `main.jsx`; this is only the route
 * table, so a feature work package never has a reason to edit this file — it
 * edits `src/routes/index.jsx` instead (Section 13.1).
 *
 * @returns {import('react').ReactElement}
 */
export default function App() {
  return <AppRoutes />;
}
