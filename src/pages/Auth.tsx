import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Store, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/wellness_logo.svg";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [accountType, setAccountType] = useState<"buyer" | "supplier">("buyer");

  // Google OAuth: new-user account-type selection modal
  const [showAccountTypeModal, setShowAccountTypeModal] = useState(false);
  const [googleAccountType, setGoogleAccountType] = useState<"buyer" | "supplier">("buyer");
  const [savingAccountType, setSavingAccountType] = useState(false);

  useEffect(() => {
    if (user) {
      // If user signed in with Google and has no account_type in their metadata yet,
      // they're a brand-new Google user — show the account-type selection modal.
      const isGoogleUser = user.app_metadata?.provider === "google";
      const hasNoAccountType = user.user_metadata?.account_type === undefined;
      const isNewUser =
        isGoogleUser &&
        hasNoAccountType &&
        Date.now() - new Date(user.created_at).getTime() < 60_000;

      if (isNewUser) {
        setShowAccountTypeModal(true);
      } else {
        navigate("/");
      }
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome back!" });
      navigate("/");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: { business_name: regName, phone: regPhone, account_type: accountType },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent a verification link to confirm your account." });
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast({ title: "Google sign in failed", description: String(result.error), variant: "destructive" });
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/");
  };

  // Saves the account type chosen after Google OAuth for new users
  const handleSaveGoogleAccountType = async () => {
    if (!user) return;
    setSavingAccountType(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ account_type: googleAccountType })
        .eq("id", user.id);
      if (error) throw error;

      // Stamp metadata so this modal never re-shows on next login
      await supabase.auth.updateUser({ data: { account_type: googleAccountType } });

      toast({ title: "Account type saved", description: `Registered as ${googleAccountType}.` });
      setShowAccountTypeModal(false);
      navigate("/");
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSavingAccountType(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Google OAuth account-type modal for new users */}
      <Dialog open={showAccountTypeModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-extrabold">One more step</DialogTitle>
            <DialogDescription>
              Tell us how you'll use Wellness so we can set up your account correctly.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={googleAccountType}
            onValueChange={(v) => setGoogleAccountType(v as "buyer" | "supplier")}
            className="grid grid-cols-2 gap-3 mt-2"
          >
            <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${googleAccountType === "buyer" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <RadioGroupItem value="buyer" id="g-buyer" className="sr-only" />
              <ShoppingBag className={`h-6 w-6 ${googleAccountType === "buyer" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="text-center">
                <p className="font-bold text-sm">Buyer</p>
                <p className="text-muted-foreground text-[10px] leading-tight">Pharmacy or retailer ordering products</p>
              </div>
            </label>
            <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${googleAccountType === "supplier" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <RadioGroupItem value="supplier" id="g-supplier" className="sr-only" />
              <Store className={`h-6 w-6 ${googleAccountType === "supplier" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="text-center">
                <p className="font-bold text-sm">Supplier</p>
                <p className="text-muted-foreground text-[10px] leading-tight">Distributor or manufacturer listing products</p>
              </div>
            </label>
          </RadioGroup>
          <Button
            className="w-full rounded-full gradient-primary text-primary-foreground font-bold mt-2"
            onClick={handleSaveGoogleAccountType}
            disabled={savingAccountType}
          >
            {savingAccountType
              ? "Saving..."
              : `Continue as ${googleAccountType === "supplier" ? "Supplier" : "Buyer"}`}
          </Button>
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="glass-card-elevated rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <img src={logo} alt="WELLNESS" className="h-8" />
          </div>

          <Button
            variant="outline"
            className="w-full mb-4 rounded-full"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="you@business.eg" required className="mt-1" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" placeholder="••••••••" required className="mt-1" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full rounded-full gradient-primary text-primary-foreground font-bold" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label className="text-sm font-bold mb-2 block">I am a</Label>
                  <RadioGroup
                    value={accountType}
                    onValueChange={(v) => setAccountType(v as "buyer" | "supplier")}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${accountType === "buyer" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <RadioGroupItem value="buyer" id="buyer" className="sr-only" />
                      <ShoppingBag className={`h-6 w-6 ${accountType === "buyer" ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-center">
                        <p className="font-bold text-sm">Buyer</p>
                        <p className="text-muted-foreground text-[10px] leading-tight">Pharmacy or retailer ordering products</p>
                      </div>
                    </label>
                    <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${accountType === "supplier" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <RadioGroupItem value="supplier" id="supplier" className="sr-only" />
                      <Store className={`h-6 w-6 ${accountType === "supplier" ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-center">
                        <p className="font-bold text-sm">Supplier</p>
                        <p className="text-muted-foreground text-[10px] leading-tight">Distributor or manufacturer listing products</p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="reg-name">Business Name</Label>
                  <Input id="reg-name" placeholder={accountType === "supplier" ? "Your Company" : "Your Pharmacy"} required className="mt-1" value={regName} onChange={e => setRegName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" placeholder="you@business.eg" required className="mt-1" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="reg-password">Password</Label>
                  <Input id="reg-password" type="password" placeholder="••••••••" required className="mt-1" minLength={8} value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="reg-phone">Phone</Label>
                  <Input id="reg-phone" type="tel" placeholder="+20 XXX XXX XXXX" required className="mt-1" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                </div>
                <Button type="submit" className="w-full rounded-full gradient-primary text-primary-foreground font-bold" disabled={loading}>
                  {loading ? "Creating account..." : `Register as ${accountType === "supplier" ? "Supplier" : "Buyer"}`}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
