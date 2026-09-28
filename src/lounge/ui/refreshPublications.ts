import {PUBLICATION_PAGE_SIZE, type Publication} from '../domain/publication';

/** Replace the latest page, retaining the older rows already opened with “more”. */
export function refreshPublications(previous:Publication[],latest:Publication[]) {
  if(latest.length<PUBLICATION_PAGE_SIZE) return latest;
  const last=latest.at(-1)!;
  // A burst larger than one page can leave an unseen gap. Restart pagination
  // from the new page instead of joining an older, disconnected cursor range.
  if(!previous.some(post=>post.id===last.id && post.updatedAt===last.updatedAt)) return latest;
  return [...latest,...previous.filter(post=>!latest.some(next=>next.id===post.id) &&
    (post.updatedAt<last.updatedAt || (post.updatedAt===last.updatedAt && post.id<last.id)))];
}
