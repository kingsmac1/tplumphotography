/** Where DMI Studios is. The pin uses the same point as staff check-in (office_settings). */
export const STUDIO = {
  name: "DMI Studios",
  address: "#12 Nwaniba Road, Uyo",
  region: "Akwa Ibom State, Nigeria",
  latitude: 5.031006,
  longitude: 7.933269,
  hotline: "+234-901-396-2323",
  email: "INFO@DMI.COM.NG",
};

const fullAddress = `${STUDIO.name}, ${STUDIO.address.replace("#", "")}, ${STUDIO.region}`;

/** Google Maps directions from wherever the visitor is. Uses the address text, which Google places best. */
export const directionsUrl = () => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

export const appleMapsUrl = () =>
  `https://maps.apple.com/?daddr=${encodeURIComponent(fullAddress)}&sll=${STUDIO.latitude},${STUDIO.longitude}`;
