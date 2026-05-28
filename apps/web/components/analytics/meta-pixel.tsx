"use client";

/**
 * Meta (Facebook) Pixel loader.
 *
 * Mounted by `AnalyticsProvider` only after the user has accepted the
 * cookie banner. Reads the pixel id from `NEXT_PUBLIC_META_PIXEL_ID`;
 * renders nothing when the id is empty.
 *
 * Uses `next/script` with `strategy="afterInteractive"`, which is the
 * recommended strategy for analytics tags (see
 * node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md).
 */
import Script from "next/script";

export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return null;

  const initScript = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
`.trim();

  return (
    <>
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: initScript }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}

export default MetaPixel;
