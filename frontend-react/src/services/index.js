/**
 * Services Index - نقطة دخول موحدة لجميع الخدمات
 * تخدم نسخة Desktop و Mobile معاً
 */

import API from './api.js';
import CoreService from './coreService.js';
import MobileService from './mobileService.js';

// تصدير جميع الخدمات
export {
    API,
    CoreService,
    MobileService
};

// تصدير الخدمات الفردية من CoreService
export const {
    CoordinateUtils,
    ProviderService,
    StatsService,
    RatingsService,
    SearchService
} = CoreService;

// تصدير الخدمات الفردية من MobileService
export const {
    TabService,
    NavigationService,
    GestureService,
    MobileScreenService,
    MobileModeService
} = MobileService;

export default {
    API,
    CoreService,
    MobileService,
    CoordinateUtils,
    ProviderService,
    StatsService,
    RatingsService,
    SearchService,
    TabService,
    NavigationService,
    GestureService,
    MobileScreenService,
    MobileModeService
};
