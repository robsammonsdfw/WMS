import React, { useState } from 'react';
import { login, signup } from '../services/api';
import { WaterDropIcon } from './icons';

interface AuthScreenProps {
  onAuthSuccess: (user: any, token: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await login({ email, password });
        onAuthSuccess(response.user, response.token);
      } else {
        const response = await signup({ email, password, role: 'farmer' });
        onAuthSuccess(response.user, response.token);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <WaterDropIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-gray-500 font-bold text-sm mt-2">
            {isLogin ? 'Secure access to your water management portal.' : 'Register for secure access to the network.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 font-bold text-sm rounded-r-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold focus:border-blue-500 focus:ring-0 outline-none transition-colors"
              placeholder="farmer@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold focus:border-blue-500 focus:ring-0 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 hover:scale-[1.02] transition-all shadow-xl shadow-blue-200 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Secure Login' : 'Register Now')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors"
          >
            {isLogin ? "Need an account? Sign up here" : "Already registered? Log in here"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;