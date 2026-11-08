import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "./auth";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <header
        style={{
          display: "flex",
          gap: 16,
          padding: 16,
          borderBottom: "1px solid #ccc",
          alignItems: "center",
        }}
      >
        <strong>Fakturko</strong>
        {user?.firmRole === "ADMIN" && <NavLink to="/clients">Stranke</NavLink>}
        <span style={{ marginLeft: "auto" }}>{user?.fullName}</span>
        <button onClick={handleLogout}>Odjava</button>
      </header>
      <main style={{ padding: 16 }}>
        <Outlet />
      </main>
    </>
  );
}
