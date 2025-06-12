import type { Payload } from 'payload'
import mongoose from 'mongoose'

// src/services/user.service.ts
export class UserService {
    constructor(private payload: Payload) {}
  
    async completeOnboarding(userId: string, data: any) {
        const session = await mongoose.startSession()
      
      try {
        await session.withTransaction(async () => {
          // 1. Update user profile
          await this.payload.update({
            collection: 'users',
            id: userId,
            data: {
              firstName: data.firstName,
              lastName: data.lastName,
              phoneNumber: data.phoneNumber,
              address: data.address,
              references: data.references
            }
          })
  
          // 2. Save documents
          for (const doc of data.documents) {
            await this.payload.create({
              collection: 'user-documents',
              data: {
                userId,
                documentType: doc.type,
                documentFile: doc.mediaId,
                verificationStatus: 'pending'
              }
            })
          }
  
          // 3. Save bank details
          await this.payload.create({
            collection: 'user-bank-details',
            data: {
              userId,
              ...data.bankDetails,
              verificationStatus: 'pending'
            }
          })
  
          // 4. Complete training
          await this.payload.create({
            collection: 'user-training',
            data: {
              userId,
              termsAccepted: true,
              termsAcceptedAt: new Date(),
              trainingCompleted: true,
              trainingCompletedAt: new Date()
            }
          })
  
          // 5. Update onboarding status
          await this.payload.create({
            collection: 'user-onboarding',
            data: {
              userId,
              currentStep: 'completed',
              onboardingStatus: 'pending_review',
              completedAt: new Date()
            }
          })
        })
  
        return { success: true, message: 'Onboarding completed' }
      } catch (error) {
        await session.abortTransaction()
        throw error
      } finally {
        await session.endSession()
      }
    }
  }