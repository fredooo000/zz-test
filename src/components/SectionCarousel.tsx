"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SectionCarouselProps {
  title: string;
  children: React.ReactNode;
  href?: string;
}

export function SectionCarousel({ title, children, href }: SectionCarouselProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {href && (
            <a
              href={href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </a>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => scroll("left")}>
            <ArrowLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => scroll("right")}>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 pb-4"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </div>
    </section>
  );
}
