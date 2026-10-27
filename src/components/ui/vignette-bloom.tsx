"use client"

// AsciiArt — "Vignette Bloom", made with the 21st.dev ASCII editor and baked
// to its exact rendered output (looping video + poster). Zero dependencies.
export function AsciiArt({ className }: { className?: string }) {
  return (
    <>
      <video
        className={`vignette-bloom__video ${className ?? ""}`}
        src={"https://assets.21st.dev/ascii-recipes/videos/user_2nElBLvklOKlAURm6W1PTu6yYFh/ce2c1d6e-d203-4519-8bd5-8fabf950352b.mp4"}
        poster={"https://assets.21st.dev/ascii-recipes/thumbnails/user_2nElBLvklOKlAURm6W1PTu6yYFh/0920f00b-2ec1-4cb9-87ec-5ba0d33c1d32.webp"}
        autoPlay
        loop
        muted
        playsInline
        aria-label={"Vignette Bloom — animated ASCII art"}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <img
        className="vignette-bloom__poster"
        src="https://assets.21st.dev/ascii-recipes/thumbnails/user_2nElBLvklOKlAURm6W1PTu6yYFh/0920f00b-2ec1-4cb9-87ec-5ba0d33c1d32.webp"
        alt=""
        aria-hidden="true"
      />
    </>
  )
}
