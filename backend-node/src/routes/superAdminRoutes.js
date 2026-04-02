import { Router } from 'express';
import { authRequired, roleRequired } from '../middleware/auth.js';
import {
  createPlan,
  createUser,
  deletePlan,
  deleteUser,
  duplicatePlan,
  getLanguages,
  getPlan,
  getStats,
  listPlans,
  listUsers,
  togglePlanStatus,
  toggleUserStatus,
  updateDefaultLanguage,
  updatePlan,
  updateSpeechLanguages,
  updateUiLanguages,
  updateUser
} from '../controllers/superAdminController.js';

const router = Router();

router.use(authRequired, roleRequired('super_admin', 'admin'));

router.get('/stats', getStats);
router.get('/users', listUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/toggle-status', toggleUserStatus);

router.get('/languages', getLanguages);
router.put('/languages/ui', updateUiLanguages);
router.put('/languages/speech', updateSpeechLanguages);
router.put('/languages/default', updateDefaultLanguage);

router.get('/subscription-plans', listPlans);
router.get('/subscription-plans/:id', getPlan);
router.post('/subscription-plans', createPlan);
router.put('/subscription-plans/:id', updatePlan);
router.patch('/subscription-plans/:id/toggle-status', togglePlanStatus);
router.delete('/subscription-plans/:id', deletePlan);
router.post('/subscription-plans/:id/duplicate', duplicatePlan);

export default router;
