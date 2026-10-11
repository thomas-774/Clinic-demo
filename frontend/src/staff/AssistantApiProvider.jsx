import { ASSISTANT, StaffApiContext } from './staffApi'

/** Wraps the assistant area so shared screens use the assistant API (Module I). */
export default function AssistantApiProvider({ children }) {
  return <StaffApiContext.Provider value={ASSISTANT}>{children}</StaffApiContext.Provider>
}
