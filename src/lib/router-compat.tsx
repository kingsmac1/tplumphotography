/**
 * Compatibility shim that lets React-Router-style code run inside TanStack Router.
 *
 * The legacy DMI source imported from "@/lib/router-compat". We sed-replaced those
 * imports to "@/lib/router-compat" so the entire codebase can keep using
 * `<Link to="/about">`, `useParams`, `useLocation`, `useNavigate` and `NavLink`
 * without rewriting every file.
 */
import { forwardRef, useCallback, type AnchorHTMLAttributes, type ReactNode } from "react";
import {
  Link as TSLink,
  useLocation as tsUseLocation,
  useNavigate as tsUseNavigate,
  useParams as tsUseParams,
} from "@tanstack/react-router";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ to, ...rest }, ref) => {
  // TanStack Router needs the path as a `to` prop. Hash links (#section) and
  // external URLs fall back to a normal anchor for safety.
  if (to.startsWith("#") || to.startsWith("http") || to.startsWith("mailto:") || to.startsWith("tel:")) {
    return <a ref={ref} href={to} {...rest} />;
  }
  return <TSLink ref={ref} to={to as never} {...rest} />;
});
Link.displayName = "Link";

type NavLinkProps = LinkProps & {
  className?: string;
  activeClassName?: string;
};

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, className, activeClassName, ...rest }, ref) => {
    const { pathname } = tsUseLocation();
    const isActive = pathname === to;
    const computed = [className, isActive ? activeClassName : ""].filter(Boolean).join(" ");
    return <Link ref={ref} to={to} className={computed} {...rest} />;
  },
);
NavLink.displayName = "NavLink";

export const useLocation = () => {
  const loc = tsUseLocation();
  return { pathname: loc.pathname, search: loc.search, hash: loc.hash, state: loc.state };
};

// Stable across renders: effects that list `navigate` as a dependency must not re-run on every render.
export const useNavigate = () => {
  const nav = tsUseNavigate();
  return useCallback(
    (to: string | number) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      nav({ to: to as never });
    },
    [nav],
  );
};

export const useParams = <T extends Record<string, string | undefined> = Record<string, string | undefined>>() =>
  tsUseParams({ strict: false }) as T;
