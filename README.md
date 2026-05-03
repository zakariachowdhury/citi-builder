# Geometry City

A hand-drawn city builder for learning geometry — draw streets, place
required buildings on the right kinds of intersections (right-angle,
acute, obtuse, transversal, parallel), and watch the city come alive.

## Live demo

Open `index.html` in any modern browser, or visit the GitHub Pages
deploy if available.

## Stack

Pure static site, no build step:

- HTML + CSS
- React 18 (UMD via CDN)
- Babel Standalone (in-browser JSX compilation)

## What's inside

- **Streets and intersections** — auto-classified as right / acute /
  obtuse / supplementary / vertical / parallel / transversal.
- **Buildings** — civic, shops, parks, nature, vehicles, landmarks
  (church, museum, hotel, hospital, amusement park, airport, …).
- **Live mode** — cars, buses, fire trucks, police cars, planes, and
  pedestrians animate over the road network with traffic-light
  obedience and follow-distance.
- **Click-to-dispatch** — pick the 🚕 tool and click any building to
  send a car driving to it via BFS over the road graph.
- **Random-city generator** — slot-grid placement with collision
  avoidance.
- **Multi-project saves** — keep several cities in browser
  localStorage and switch between them.
- **Export / import** — JSON for sharing, PNG for snapshots, print
  for paper.

## Running locally

```bash
python3 -m http.server 8080
# then open http://localhost:8080/
```

(or any other static file server)
