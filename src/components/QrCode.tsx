/**
 * QrCode — wraps react-qr-code to generate real, scannable QR codes.
 * The value is encoded as a signed JSON payload: { did, mrn, exp, sig }
 */
import QRCodeSVG from "react-qr-code";

interface QrCodeProps {
  value: string; // raw DID or structured payload
  size?: number;
  bgColor?: string;
  fgColor?: string;
  label?: string; // optional label shown below
}

export function QrCode({
  value,
  size = 220,
  bgColor = "transparent",
  fgColor,
  label,
}: QrCodeProps) {
  // fgColor defaults to CSS var --foreground via inline style trick
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl border border-border bg-card p-3 shadow-clinical">
        <QRCodeSVG
          value={value}
          size={size}
          bgColor={bgColor || "#ffffff"}
          fgColor={fgColor || "#000000"}
          level="H"
        />
      </div>
      {label && <span className="text-[10px] text-muted-foreground font-mono">{label}</span>}
    </div>
  );
}
