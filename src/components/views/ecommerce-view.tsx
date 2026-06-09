'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, ShoppingBag, CreditCard, Truck, BarChart3, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const modules = [
  { name: 'Product Catalog', icon: ShoppingBag, description: 'Manage products with variants, images, pricing, and SEO.' },
  { name: 'Shopping Cart', icon: ShoppingCart, description: 'Cart management with promotions, discounts, and recovery.' },
  { name: 'Payments', icon: CreditCard, description: 'Payment processing with Stripe, PayPal, and multi-currency.' },
  { name: 'Shipping', icon: Truck, description: 'Shipping management with carriers, tracking, and fulfillment.' },
  { name: 'Analytics', icon: BarChart3, description: 'eCommerce analytics with conversion and revenue tracking.' },
  { name: 'Orders', icon: Package, description: 'Order management from placement to delivery and returns.' },
];

export default function EcommerceView() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-emerald-600" />
          eCommerce
        </h1>
        <p className="text-muted-foreground mt-1">Manage your online store, products, orders, and payments.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module, i) => (
            <motion.div
              key={module.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
            >
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full p-4 bg-emerald-100 dark:bg-emerald-900/50 mb-4">
                    <module.icon className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold">{module.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs">{module.description}</p>
                  <Badge variant="secondary" className="mt-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    Coming Soon
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
