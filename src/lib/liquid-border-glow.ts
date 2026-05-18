const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function resetLiquidBorderGlow(element: HTMLElement, isDarkMode: boolean) {
  element.style.setProperty("--liquid-angle", "45deg");
  element.style.setProperty("--liquid-border-opacity", "0");
  element.style.setProperty("--liquid-fill-opacity", "0");
  element.style.setProperty("--liquid-glow-opacity", "0");
}

export function updateLiquidBorderGlow(
  element: HTMLElement,
  clientX: number,
  clientY: number,
  isDarkMode: boolean
) {
  const rect = element.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const dx = x - centerX;
  const dy = y - centerY;
  const radians = Math.atan2(dy, dx);
  let degrees = radians * (180 / Math.PI) + 90;

  if (degrees < 0) {
    degrees += 360;
  }

  const kx = dx === 0 ? Infinity : centerX / Math.abs(dx);
  const ky = dy === 0 ? Infinity : centerY / Math.abs(dy);
  const edgeProximity = clamp(1 / Math.min(kx, ky), 0, 1);
  const edgeStrength = clamp((edgeProximity * 100 - 34) / 66, 0, 1);

  const borderOpacity = isDarkMode
    ? clamp(edgeStrength * 0.9, 0, 0.9)
    : clamp(edgeStrength * 0.96, 0, 0.96);
  const fillOpacity = isDarkMode
    ? clamp(edgeStrength * 0.082, 0, 0.082)
    : clamp(edgeStrength * 0.12, 0, 0.12);
  const glowOpacity = isDarkMode
    ? clamp(edgeStrength * 0.52, 0, 0.52)
    : clamp(edgeStrength * 0.62, 0, 0.62);

  element.style.setProperty("--liquid-angle", `${degrees.toFixed(3)}deg`);
  element.style.setProperty("--liquid-border-opacity", borderOpacity.toFixed(3));
  element.style.setProperty("--liquid-fill-opacity", fillOpacity.toFixed(3));
  element.style.setProperty("--liquid-glow-opacity", glowOpacity.toFixed(3));
}
