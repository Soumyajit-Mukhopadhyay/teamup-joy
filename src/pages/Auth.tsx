import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, AtSign, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { z } from 'zod';

const signUpSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters').max(50, 'Username too long'),
  userid: z.string()
    .min(3, 'User ID must be at least 3 characters')
    .max(20, 'User ID must be at most 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'signin';
  const navigate = useNavigate();
  const { user, signUp, signIn, signInWithGoogle, resetPassword, checkUserIdAvailable, generateUserIdSuggestions } = useAuth();

  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [userIdAvailable, setUserIdAvailable] = useState<boolean | null>(null);
  const [checkingUserId, setCheckingUserId] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    userid: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (formData.userid.length >= 3 && isSignUp) {
        setCheckingUserId(true);
        const available = await checkUserIdAvailable(formData.userid);
        setUserIdAvailable(available);
        setCheckingUserId(false);
        
        if (!available && formData.username) {
          const sugs = await generateUserIdSuggestions(formData.username);
          setSuggestions(sugs);
        } else {
          setSuggestions([]);
        }
      } else {
        setUserIdAvailable(null);
        setSuggestions([]);
      }
    }, 500); // Debounce

    return () => clearTimeout(timeoutId);
  }, [formData.userid, formData.username, isSignUp, checkUserIdAvailable, generateUserIdSuggestions]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newValue = name === 'userid' ? value.toLowerCase().replace(/[^a-z0-9_]/g, '') : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Email validation for all flows
    const emailResult = z.string().email('Invalid email format').safeParse(formData.email);
    if (!emailResult.success) {
      setErrors({ email: 'Invalid email ID. Please enter a valid email address.' });
      setLoading(false);
      return;
    }

    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(formData.email);
        if (error) throw error;
        toast.success('Password reset email sent! Check your inbox.');
        setIsForgotPassword(false);
      } else if (isSignUp) {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }
        
        if (userIdAvailable === false) {
          setErrors({ userid: 'This User ID is already taken. Please choose another.' });
          setLoading(false);
          return;
        }

        if (userIdAvailable === null) {
          setErrors({ userid: 'Please wait for User ID availability check' });
          setLoading(false);
          return;
        }

        const { error } = await signUp(formData.email, formData.password, formData.username, formData.userid.toLowerCase());
        if (error) {
          if (error.message?.includes('already registered')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw error;
        }
        toast.success('Account created successfully! Welcome aboard!');
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message?.includes('Invalid login credentials')) {
            throw new Error('Invalid email or password. Please try again.');
          }
          throw error;
        }
        toast.success('Signed in successfully!');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
  };

  const selectSuggestion = (suggestion: string) => {
    setFormData(prev => ({ ...prev, userid: suggestion }));
    setUserIdAvailable(true);
    setSuggestions([]);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-muted-foreground">
            {isForgotPassword ? 'Enter your email to reset password' : isSignUp ? 'Join the hackathon community' : 'Sign in to continue'}
          </p>
        </div>

        <div className="glass-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && !isForgotPassword && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="username" 
                      name="username" 
                      value={formData.username} 
                      onChange={handleChange} 
                      placeholder="Your display name" 
                      className="pl-9 input-dark" 
                    />
                  </div>
                  {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userid">Unique User ID</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="userid" 
                      name="userid" 
                      value={formData.userid} 
                      onChange={handleChange} 
                      placeholder="yourname123" 
                      className="pl-9 pr-10 input-dark" 
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUserId && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {!checkingUserId && userIdAvailable === true && <CheckCircle2 className="h-4 w-4 text-success" />}
                      {!checkingUserId && userIdAvailable === false && <XCircle className="h-4 w-4 text-destructive" />}
                    </div>
                  </div>
                  {userIdAvailable === true && formData.userid.length >= 3 && (
                    <p className="text-xs text-success">This User ID is available!</p>
                  )}
                  {errors.userid && <p className="text-xs text-destructive">{errors.userid}</p>}
                  {suggestions.length > 0 && (
                    <div className="bg-secondary/50 rounded-lg p-3 mt-2">
                      <p className="text-xs text-muted-foreground mb-2">Try one of these available IDs:</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map(s => (
                          <button 
                            key={s} 
                            type="button" 
                            onClick={() => selectSuggestion(s)} 
                            className="text-sm text-primary hover:underline bg-primary/10 px-2 py-1 rounded"
                          >
                            @{s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  placeholder="you@example.com" 
                  className="pl-9 input-dark" 
                  required 
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {!isForgotPassword && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="password" 
                      name="password" 
                      type={showPassword ? 'text' : 'password'} 
                      value={formData.password} 
                      onChange={handleChange} 
                      placeholder="••••••••" 
                      className="pl-9 pr-9 input-dark" 
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="confirmPassword" 
                        name="confirmPassword" 
                        type={showPassword ? 'text' : 'password'} 
                        value={formData.confirmPassword} 
                        onChange={handleChange} 
                        placeholder="••••••••" 
                        className="pl-9 input-dark" 
                        required 
                      />
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                  </div>
                )}
              </>
            )}

            <Button type="submit" className="w-full btn-gradient" disabled={loading || (isSignUp && checkingUserId)}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                isForgotPassword ? 'Send Reset Email' : isSignUp ? 'Sign Up' : 'Sign In'
              )}
            </Button>
          </form>

          {!isForgotPassword && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">or</span></div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            </>
          )}

          <div className="mt-6 text-center text-sm">
            {isForgotPassword ? (
              <button onClick={() => setIsForgotPassword(false)} className="text-primary hover:underline">Back to Sign In</button>
            ) : (
              <>
                {!isSignUp && <button onClick={() => setIsForgotPassword(true)} className="text-muted-foreground hover:text-foreground block w-full mb-2">Forgot password?</button>}
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline">
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;