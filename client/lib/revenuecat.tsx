import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import Purchases, { 
  PurchasesPackage, 
  CustomerInfo, 
  PurchasesOffering,
  LOG_LEVEL
} from 'react-native-purchases';

const ENTITLEMENT_ID = 'MatchDay Hub Pro';
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

interface RevenueCatContextType {
  isElite: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType>({
  isElite: false,
  isLoading: true,
  customerInfo: null,
  currentOffering: null,
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  refreshCustomerInfo: async () => {},
});

export function useRevenueCat() {
  return useContext(RevenueCatContext);
}

interface RevenueCatProviderProps {
  children: ReactNode;
}

export function RevenueCatProvider({ children }: RevenueCatProviderProps) {
  const [isElite, setIsElite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);

  const checkEntitlement = useCallback((info: CustomerInfo) => {
    const entitlement = info.entitlements.active[ENTITLEMENT_ID];
    setIsElite(entitlement !== undefined);
    setCustomerInfo(info);
  }, []);

  const refreshCustomerInfo = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      checkEntitlement(info);
    } catch (error) {
      console.error('Error refreshing customer info:', error);
    }
  }, [checkEntitlement]);

  useEffect(() => {
    const initRevenueCat = async () => {
      try {
        if (!API_KEY) {
          console.warn('RevenueCat API key not configured');
          setIsLoading(false);
          return;
        }

        Purchases.setLogLevel(LOG_LEVEL.DEBUG);

        if (Platform.OS === 'ios') {
          await Purchases.configure({ apiKey: API_KEY });
        } else if (Platform.OS === 'android') {
          await Purchases.configure({ apiKey: API_KEY });
        } else {
          console.log('RevenueCat not available on web');
          setIsLoading(false);
          return;
        }

        Purchases.addCustomerInfoUpdateListener((info) => {
          checkEntitlement(info);
        });

        const info = await Purchases.getCustomerInfo();
        checkEntitlement(info);

        try {
          const offerings = await Purchases.getOfferings();
          if (offerings.current) {
            setCurrentOffering(offerings.current);
          }
        } catch (offeringsError) {
          console.error('Error fetching offerings:', offeringsError);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing RevenueCat:', error);
        setIsLoading(false);
      }
    };

    initRevenueCat();
  }, [checkEntitlement]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo: newInfo } = await Purchases.purchasePackage(pkg);
      checkEntitlement(newInfo);
      return newInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (error: any) {
      if (error.userCancelled) {
        return false;
      }
      console.error('Error purchasing package:', error);
      throw error;
    }
  }, [checkEntitlement]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      checkEntitlement(info);
      return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  }, [checkEntitlement]);

  return (
    <RevenueCatContext.Provider
      value={{
        isElite,
        isLoading,
        customerInfo,
        currentOffering,
        purchasePackage,
        restorePurchases,
        refreshCustomerInfo,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}
