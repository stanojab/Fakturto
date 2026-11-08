import { useAuth } from "../auth";

// Temporary start page for roles whose screens are not built yet
export default function WelcomePage() {
  const { user } = useAuth();
  return <h1>Pozdravljeni, {user?.fullName}</h1>;
}
