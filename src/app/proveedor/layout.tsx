"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Upload,
  Package,
  BarChart3,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    label: "Dashboard",
    href: "/proveedor/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Subir Catálogo",
    href: "/proveedor/subir",
    icon: Upload,
  },
  {
    label: "Productos",
    href: "/proveedor/productos",
    icon: Package,
  },
  {
    label: "Estadísticas",
    href: "/proveedor/estadisticas",
    icon: BarChart3,
  },
];

export default function ProveedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-6 border-b">
          <Link href="/proveedor/dashboard" className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Cuqui</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Panel de Proveedor</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start gap-3"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t">
          {isSignedIn && <UserButton />}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
