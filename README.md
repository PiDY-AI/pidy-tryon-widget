# PIDY Virtual Try-On Widget

Headless React component for integrating PIDY's virtual try-on into any brand website.

## How It Works

1. Shows a "Digital Fitting Room" button on your product page
2. User selects a size and clicks the button
3. If NOT signed in: auth popup opens automatically, user signs in, popup closes
4. If already signed in: try-on starts immediately
5. Generated try-on image appears inline on the page

No visible widget iframe. No door icon. No sign-in screen. Just your button and the result.

## Installation

Copy `PidyTryOn.tsx` into your React project. No additional dependencies required (only React).

## Usage

```tsx
import { PidyTryOn } from "./PidyTryOn";

function ProductPage() {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  return (
    <div>
      {/* Your size selector */}
      <div>
        {["S", "M", "L", "XL"].map((size) => (
          <button key={size} onClick={() => setSelectedSize(size)}>
            {size}
          </button>
        ))}
      </div>

      {/* PIDY Try-On - just drop this in */}
      <PidyTryOn
        productId="OVO-STAN-VRS-2025-001"
        size={selectedSize || undefined}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | Product ID registered with PIDY |
| `size` | `string` | No | Selected size (S, M, L, XL, etc.) |

## Available Test Product IDs

| ID | Product |
|----|---------|
| `OVO-STAN-VRS-2025-001` | Stanford Varsity Jacket |
| `KITH-LAX-PKT-2025-002` | Essential Pocket Tee |
| `KNIT-POLO-JNY-2025-003` | Knit Polo Sweater |
| `W-LEG-DENIM-2025-004` | Wide Leg Denim |
| `BTN-DWN-BRW-2025-005` | Button Down Oxford Shirt |
| `JCREW-STRIPE-DRS-2026-006` | J.Crew Striped Smocked Dress |
| `AEO-LACE-CUL-2026-007` | AEO Lace Trim Culottes |
| `NEXT-CP-BTN-2026-008` | Next Lemon Print Shirt |
| `NEXT-CRM-SHRT-2026-009` | Next Braided Belt Shorts |
| `SHEIN-RIB-TNK-2026-010` | SHEIN Ribbed Square Neck Tank |
| `SWIM-FLOR-BKN-2026-011` | Floral Print Bikini Set |

## How It Works Internally

The component uses PIDY's SDK in **headless mode**:

1. Loads `sdk.js` from `https://pidy-tryon.vercel.app/sdk.js`
2. Creates a hidden 1px iframe (invisible to users) that handles auth and API calls
3. Communicates with the iframe via `window.postMessage`
4. Auth popup opens/closes automatically when needed
5. Try-on result images are returned via `postMessage` and displayed inline

## Important Notes

- The SDK requires the page to be served from a web server (not `file://`)
- Auth tokens are stored centrally on PIDY's domain for cross-brand persistence
- Users only need to sign in once across all brand websites using PIDY
