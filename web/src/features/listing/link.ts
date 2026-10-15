import { targetKey, type MapTarget } from '../map/targets';

/** A listing's own address: `/l/<type key>/<id>` (rent | sale | land | a service type; the property's fid or service id). */
export const listingPath = (target: MapTarget, id: string) =>
  `/l/${encodeURIComponent(targetKey(target))}/${encodeURIComponent(id)}`;

/** The same, absolute — what goes into a WhatsApp message or the share sheet. */
export const listingUrl = (target: MapTarget, id: string, origin = window.location.origin) =>
  origin + listingPath(target, id);

/** `wa.me` with a ready text: the listing's title, then its link (WhatsApp turns the link into a preview). */
export const whatsappShareLink = (title: string, url: string) =>
  `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
