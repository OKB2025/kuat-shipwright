# Coruscant surface and the red dwarf Anza

## Coruscant

The surface textures were supplied by the user on 2026-11-07. The author and the licence were not supplied.

`data/coruscant.js` holds two equirectangular JPEG images, north up:

- `day`: the diffuse colour at 4096 × 2048.
- `aux`: three maps packed into one image at 2048 × 1024.
  - R: the city lights (the "Lights Metropolis" map).
  - G: the cloud cover.
  - B: the specular map. The shader does not use it yet.

The supplied bump maps are not used.

The planet shader (kind 0) maps these images about the planet's axis.

- **From orbit:** the supplied surface shows. The city lights glow on the night side, and the clouds lie on top.
- **Close in:** the procedural city grid keeps its own fine detail, tinted by the supplied colours and lights. The
  blend runs on the ground footprint of a pixel: below about 1.5 km a pixel the grid takes over.

Where `OES_standard_derivatives` is available, the longitude seam is sampled continuously.

Without `data/coruscant.js`, the procedural city is drawn as before. The single-file build does not carry the
`data/` folder, so it draws the procedural city.

## Abregado and Anza

The Abregado system orbits the red dwarf Anza. This was the user's setting on 2026-11-07.

The system's sun lies in Anza's direction. The sky shows Anza as a red disc 0.13 rad in angular radius, with a churning
surface, a darkened limb and a red corona, in place of the white sun disc. The setting lives in the system's `v.star`
entry in `js/core.js`.
