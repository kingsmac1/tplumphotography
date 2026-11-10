/**
 * Unsaved invoice changes. The dashboard's side menu switches sections without a link, so it asks here before leaving
 * the invoice editor; links inside the page are caught by the editor itself.
 */
let dirty = false
export const setInvoiceDirty = (v: boolean) => { dirty = v }
export const LEAVE_QUESTION = 'Leave this invoice without saving your changes?'
/** true when it is fine to leave the invoice editor now */
export const canLeaveInvoice = () => {
  if (!dirty || typeof window === 'undefined') return true
  if (!window.confirm(LEAVE_QUESTION)) return false
  dirty = false
  return true
}
