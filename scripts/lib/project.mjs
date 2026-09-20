export const PROJECTION = {
  lonScale: 91.952899,
  lonOffset: -1726.368333,
  latScale: -131.393770,
  latOffset: 6415.664401,
};

export function project(lon, lat) {
  return {
    x: PROJECTION.lonScale * lon + PROJECTION.lonOffset,
    y: PROJECTION.latScale * lat + PROJECTION.latOffset,
  };
}
