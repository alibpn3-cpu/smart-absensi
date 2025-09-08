import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import bcrypt from 'bcryptjs';

const Login = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Error",
        description: "Please enter both username and password",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // First, validate against admin_accounts table
      const { data: adminData, error: adminError } = await supabase
        .from('admin_accounts')
        .select('*')
        .eq('username', credentials.username)
        .single();

      if (adminError || !adminData) {
        toast({
          title: "Login Failed",
          description: "Invalid username or password",
          variant: "destructive"
        });
        return;
      }

      // Compare password with stored hash
      const isPasswordValid = await bcrypt.compare(credentials.password, adminData.password_hash);
      
      if (!isPasswordValid) {
        toast({
          title: "Login Failed",
          description: "Invalid username or password",
          variant: "destructive"
        });
        return;
      }

      // Now authenticate with Supabase Auth using email format
      const email = `${credentials.username}@admin.local`;
      
      // Try to sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: credentials.password
      });

      // If sign in fails, create the user first
      if (signInError) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: credentials.password,
          options: {
            data: {
              username: credentials.username,
              role: 'admin'
            }
          }
        });

        if (signUpError) {
          console.error('Sign up error:', signUpError);
          toast({
            title: "Error",
            description: "Failed to create admin session",
            variant: "destructive"
          });
          return;
        }

        // Sign in after sign up
        const { error: secondSignInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: credentials.password
        });

        if (secondSignInError) {
          console.error('Second sign in error:', secondSignInError);
          toast({
            title: "Error",
            description: "Failed to authenticate",
            variant: "destructive"
          });
          return;
        }
      }

      toast({
        title: "Success",
        description: "Successfully logged in!"
      });

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Error",
        description: "An error occurred during login",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Attendance
        </Button>

        {/* Login Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <p className="text-muted-foreground">
              Enter your credentials to access the dashboard
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ 
                    ...prev, 
                    username: e.target.value 
                  }))}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ 
                    ...prev, 
                    password: e.target.value 
                  }))}
                  disabled={loading}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;