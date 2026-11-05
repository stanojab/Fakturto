import { NavLink, Outlet } from "react-router";

export default function Layout() {
  return (
    <>
      <header
        style={{
          display: "flex",
          gap: 16,
          padding: 16,
          borderBottom: "1px solid #ccc",
        }}
      >
        <strong>Fakturko</strong>
        <NavLink to="/clients">Stranke</NavLink>
      </header>
      <main style={{ padding: 16 }}>
        <Outlet />
      </main>
    </>
  );
}
