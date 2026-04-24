import { Link } from "react-router-dom";
import logo from "@/assets/wellness_logo.svg";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border mt-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src={logo} alt="WELLNESS" className="h-7" />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Egypt's first B2B online pharmaceutical platform. Trusted by pharmacies nationwide.
            </p>
          </div>

          <div>
            <h4 className="font-heading font-bold text-sm mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/shop" className="hover:text-primary transition-colors">Browse Catalog</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">Deals</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">New Arrivals</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-sm mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Shipping Info</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Returns</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-sm mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>support@wellness.eg</li>
              <li>+20 2 XXXX XXXX</li>
              <li>Cairo, Egypt</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
          <p>© 2026 WELLNESS. All rights reserved.</p>
          <div className="flex gap-4 mt-2 md:mt-0">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
