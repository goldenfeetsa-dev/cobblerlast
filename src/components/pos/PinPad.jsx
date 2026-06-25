import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PinPad({ onSubmit, error, isLoading }) {
  const [pin, setPin] = useState('');

  const handleDigit = (digit) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) onSubmit(newPin);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (pin.length === 4) onSubmit(pin);
  };

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* PIN Display */}
      <div className="flex gap-3">
        {[0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            animate={{ scale: pin.length > i ? 1.1 : 1 }}
            className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
              pin.length > i
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card'
            }`}
          >
            {pin.length > i ? '●' : ''}
          </motion.div>
        ))}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-destructive text-sm font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {digits.map((d, i) => {
          if (d === null) return <div key={i} />;
          if (d === 'del') {
            return (
              <Button
                key={i}
                variant="outline"
                className="h-16 text-lg rounded-xl"
                onClick={handleDelete}
                disabled={pin.length === 0}
              >
                <Delete className="w-5 h-5" />
              </Button>
            );
          }
          return (
            <Button
              key={i}
              variant="outline"
              className="h-16 text-xl font-semibold rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-all"
              onClick={() => handleDigit(String(d))}
              disabled={pin.length >= 4}
            >
              {d}
            </Button>
          );
        })}
      </div>

      {isLoading && (
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
}