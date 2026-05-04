"use client";

import { useEffect, useRef } from "react";
import type { TooltipPayload } from "./intelligence-data";

type Props = {
  payload: TooltipPayload | null;
  anchor: DOMRect | null;
};

export function Tooltip({ payload, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !payload || !anchor) return;
    const ttRect = el.getBoundingClientRect();
    let left = anchor.left + anchor.width / 2 - ttRect.width / 2;
    let top = anchor.top - ttRect.height - 10;
    if (top < 10) top = anchor.bottom + 10;
    if (left < 10) left = 10;
    if (left + ttRect.width > window.innerWidth - 10) {
      left = window.innerWidth - ttRect.width - 10;
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [payload, anchor]);

  if (!payload) {
    return <div ref={ref} className="tooltip" aria-hidden="true" />;
  }

  const { title, meta, rent, market, scope, gap, conf, formula } = payload;
  let gapClass = "";
  if (gap?.startsWith("+")) gapClass = "danger";
  else if (gap?.startsWith("−") || gap?.startsWith("-")) gapClass = "success";

  let confLabel: { cls: string; text: string } | null = null;
  if (conf === "high") confLabel = { cls: "success", text: "● high confidence" };
  else if (conf === "medium" || conf === "med")
    confLabel = { cls: "warning", text: "● medium confidence" };
  else if (conf === "low") confLabel = { cls: "danger", text: "● low confidence" };

  return (
    <div ref={ref} className="tooltip show" role="tooltip">
      <div className="tooltip-title">{title}</div>
      {meta ? <div className="tooltip-meta">{meta}</div> : null}
      <div className="tooltip-row">
        <span className="label">Lease pays</span>
        <span className="value">{rent}</span>
      </div>
      <div className="tooltip-row">
        <span className="label">Market avg</span>
        <span className="value">{market}</span>
      </div>
      <div className="tooltip-row">
        <span className="label">Scope used</span>
        <span className="value">{scope}</span>
      </div>
      <div className="tooltip-divider" />
      <div className="tooltip-row">
        <span className="label">Gap</span>
        <span className={`value ${gapClass}`}>{gap}</span>
      </div>
      {confLabel ? (
        <div className="tooltip-row">
          <span className="label">Confidence</span>
          <span className={`value ${confLabel.cls}`}>{confLabel.text}</span>
        </div>
      ) : null}
      {formula ? <div className="tooltip-formula">{formula}</div> : null}
    </div>
  );
}
