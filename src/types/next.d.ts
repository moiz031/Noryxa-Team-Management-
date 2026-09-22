// Type declarations for Next.js submodules
declare module "next" {
  import type { NextConfig } from "next/dist/server/config-shared";
  export type { NextConfig };
  export type Metadata = Record<string, unknown>;
  export type Viewport = Record<string, unknown>;
  export type ResolvingMetadata = Promise<Metadata>;
  export type ResolvingViewport = Promise<Record<string, unknown>>;
}

declare module "next/server" {
  export class NextRequest extends Request {
    cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      set(name: string, value: string): void;
    };
    nextUrl: URL;
    url: string;
    constructor(input: RequestInfo | URL, init?: RequestInit);
  }
  export class NextResponse extends Response {
    static next(init?: { request?: { headers?: Headers } | NextRequest }): NextResponse;
    static redirect(url: string | URL, status?: number): NextResponse;
    static json(body: unknown, init?: ResponseInit): NextResponse;
    cookies: {
      set(name: string, value: string, options?: unknown): void;
      set(cookie: { name: string; value: string; [key: string]: unknown }): void;
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
    };
  }
}

declare module "next/headers" {
  export function cookies(): Promise<{
    getAll(): { name: string; value: string }[];
    set(name: string, value: string, options?: unknown): void;
  }>;
}

declare module "next/navigation" {
  export function redirect(url: string): never;
  export function useRouter(): unknown;
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
}

declare module "next/link" {
  import type { ComponentProps, FC } from "react";
  const Link: FC<ComponentProps<"a"> & { href: string }>;
  export default Link;
}

declare module "next/types.js" {
  export type ResolvingMetadata = Promise<Record<string, unknown>>;
  export type ResolvingViewport = Promise<Record<string, unknown>>;
}

declare module "next/server.js" {
  export * from "next/server";
}

declare module "next/dist/lib/metadata/types/metadata-interface.js" {
  export type ResolvingMetadata = Promise<Record<string, unknown>>;
  export type ResolvingViewport = Promise<Record<string, unknown>>;
}
