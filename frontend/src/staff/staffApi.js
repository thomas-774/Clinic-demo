import { createContext, useContext } from 'react'
import {
  useAssistantAddPayment,
  useAssistantBookForPatient,
  useAssistantCreatePatient,
  useAssistantPatients,
  useAssistantSchedule,
  useAssistantUpdateAppointmentStatus,
  useAssistantUpdatePatient,
} from '../hooks/useAssistant'
import { useUpdatePatient } from '../hooks/usePatient'
import { useCreatePatient, usePatients } from '../hooks/usePatients'
import { useBookForPatient, useSchedule, useUpdateAppointmentStatus } from '../hooks/useSchedule'
import { useAddPayment } from '../hooks/useVisits'

/**
 * The screens shared by the doctor and the assistant (schedule views, the
 * booking, new-patient and payment modals) take their data hooks from here,
 * so the same component calls /doctor/* or /assistant/* (Module I).
 */
const DOCTOR = {
  area: 'doctor',
  canStartVisit: true,
  showIllness: true,
  useSchedule,
  useUpdateAppointmentStatus,
  useBookForPatient,
  usePatients,
  useCreatePatient,
  useUpdatePatient,
  useAddPayment,
}

export const ASSISTANT = {
  area: 'assistant',
  canStartVisit: false,
  showIllness: false,
  useSchedule: useAssistantSchedule,
  useUpdateAppointmentStatus: useAssistantUpdateAppointmentStatus,
  useBookForPatient: useAssistantBookForPatient,
  usePatients: useAssistantPatients,
  useCreatePatient: useAssistantCreatePatient,
  useUpdatePatient: useAssistantUpdatePatient,
  useAddPayment: useAssistantAddPayment,
}

export const StaffApiContext = createContext(DOCTOR)

export function useStaffApi() {
  return useContext(StaffApiContext)
}

