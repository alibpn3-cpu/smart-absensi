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
    console.log('Attempting login with:', credentials.username);
    
    try {
      // First, validate against admin_accounts table
      console.log('Fetching admin account...');
      const { data: adminData, error: adminError } = await supabase
        .from('admin_accounts')
        .select('*')
        .eq('username', credentials.username)
        .maybeSingle();

      console.log('Admin data:', adminData, 'Error:', adminError);

      if (adminError) {
        console.error('Database error:', adminError);
        toast({
          title: "Database Error",
          description: `Error: ${adminError.message}`,
          variant: "destructive"
        });
        return;
      }

      if (!adminData) {
        console.log('No admin account found for username:', credentials.username);
        toast({
          title: "Login Failed",
          description: "Invalid username or password",
          variant: "destructive"
        });
        return;
      }

      // Compare password with stored hash
      console.log('Comparing passwords...');
      const isPasswordValid = await bcrypt.compare(credentials.password, adminData.password_hash);
      console.log('Password valid:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('Password comparison failed');
        toast({
          title: "Login Failed", 
          description: "Invalid username or password",
          variant: "destructive"
        });
        return;
      }

      // Successful login - create session manually since we don't use Supabase Auth
      console.log('Login successful, navigating to dashboard...');
      
      // Store admin session in localStorage
      localStorage.setItem('adminSession', JSON.stringify({
        username: credentials.username,
        loginTime: new Date().toISOString()
      }));

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
        description: `Login error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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